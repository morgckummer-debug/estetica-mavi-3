# ============================================================
# MAVI - migracao UNICA: cria uma linha em `clientes` para cada pessoa ja
# cadastrada nas fichas, e preenche `fichas.cliente_id`.
#
# Roda uma vez so, depois de aplicar as migracoes SQL 0012 e 0013 no
# Supabase (SQL Editor). Precisa da chave SERVICE ROLE (nao a anon) porque
# le/escreve ignorando o RLS - pegue em Project Settings > API Keys >
# service_role, no painel do Supabase.
#
# Uso (PowerShell, sem precisar instalar nada):
#   $env:SUPABASE_URL = "https://xxxx.supabase.co"
#   $env:SUPABASE_SERVICE_ROLE_KEY = "eyJhbGc..."
#   .\migrar-clientes.ps1
#
# Por padrao roda em modo "dry run" (so mostra o que faria, nao grava nada).
# Pra gravar de verdade: .\migrar-clientes.ps1 -Confirmar
#
# Agrupa fichas da MESMA pessoa pelo mesmo criterio ja usado no app: nome
# normalizado + (telefone OU CPF) batendo. Nao mexe no conteudo de
# `fichas.respostas` - so cria o cadastro e liga `cliente_id`.
# ============================================================

param(
    [switch]$Confirmar
)

$ErrorActionPreference = "Stop"

$SupabaseUrl = $env:SUPABASE_URL
$ServiceKey = $env:SUPABASE_SERVICE_ROLE_KEY

if (-not $SupabaseUrl -or -not $ServiceKey) {
    Write-Error "Defina as variaveis SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY (Project Settings > API Keys > service_role) antes de rodar."
    exit 1
}

function Invoke-Api {
    param(
        [string]$Path,
        [string]$Method = "GET",
        $Body = $null,
        [string]$Prefer = $null
    )
    $headers = @{
        "apikey"        = $ServiceKey
        "Authorization" = "Bearer $ServiceKey"
    }
    if ($Prefer) { $headers["Prefer"] = $Prefer }

    $uri = "$SupabaseUrl/rest/v1/$Path"
    Write-Host "[debug] $Method $uri (headers: $($headers.Keys -join ', '))" -ForegroundColor DarkGray
    if ($null -ne $Body) {
        # Usa -InputObject em vez de "$Body | ConvertTo-Json": passar um
        # [ordered]@{} (ou hashtable) pelo pipe pode fazer o PowerShell
        # "desenrolar" cada chave/valor separadamente em vez de converter o
        # objeto inteiro de uma vez - -InputObject evita essa ambiguidade.
        $json = ConvertTo-Json -InputObject $Body -Depth 10 -Compress
        Write-Host "[debug] corpo enviado: $json" -ForegroundColor DarkGray
        # Manda o corpo como bytes UTF-8 explicitos: no Windows PowerShell,
        # passar uma string com acento (ex.: "Cândido") direto pro -Body faz
        # a contagem de bytes ficar errada e o Supabase recusar como corpo
        # vazio/invalido (PGRST102) - convertendo pra bytes na mao isso nao
        # acontece.
        $jsonBytes = [System.Text.Encoding]::UTF8.GetBytes($json)
        $resultado = Invoke-RestMethod -Uri $uri -Method $Method -Headers $headers -Body $jsonBytes -ContentType "application/json; charset=utf-8"
        Write-Host "[debug] resposta: $($resultado.Count) item(ns)" -ForegroundColor DarkGray
        return $resultado
    }
    $resultado = Invoke-RestMethod -Uri $uri -Method $Method -Headers $headers
    Write-Host "[debug] resposta: $($resultado.Count) item(ns)" -ForegroundColor DarkGray
    return $resultado
}

function Get-Digitos([string]$v) {
    if (-not $v) { return "" }
    return ($v -replace '\D', '')
}

$script:PatternAcentos = "[$([char]0x0300)-$([char]0x036f)]"

function Get-NomeNormalizado([string]$v) {
    if (-not $v) { return "" }
    $formD = $v.Normalize([Text.NormalizationForm]::FormD)
    # Remove marcas de acentuacao combinantes (U+0300 a U+036F), depois de
    # decompor o texto (ex.: "a" + acento agudo em vez de "á" pronto).
    $semAcento = [regex]::Replace($formD, $script:PatternAcentos, "")
    $semAcento = $semAcento.Trim().ToLower()
    return ($semAcento -replace '\s+', ' ')
}

# Find/Union do union-find recebem $pai (o array) como parametro explicito
# em vez de fechar sobre uma variavel de fora - arrays sao passados por
# referencia em PowerShell, entao a mutacao "$pai[i] = valor" dentro da
# funcao altera o mesmo array de quem chamou, sem depender de escopo
# aninhado (mais previsivel de revisar/rodar sem poder testar antes).
function Find-Raiz([int[]]$pai, [int]$i) {
    while ($pai[$i] -ne $i) {
        $pai[$i] = $pai[$pai[$i]]
        $i = $pai[$i]
    }
    return $i
}

function Union-Grupos([int[]]$pai, [int]$a, [int]$b) {
    $ra = Find-Raiz $pai $a
    $rb = Find-Raiz $pai $b
    $pai[$ra] = $rb
}

# Mesma logica de union-find usada em src/lib/clientes.ts (agruparClientes).
function Group-Fichas($fichas) {
    $n = $fichas.Count
    if ($n -eq 0) { return @() }

    $pai = New-Object 'int[]' $n
    for ($i = 0; $i -lt $n; $i++) { $pai[$i] = $i }

    $porNomeTelefone = @{}
    $porNomeCpf = @{}
    for ($i = 0; $i -lt $n; $i++) {
        $f = $fichas[$i]
        $nome = Get-NomeNormalizado $f.nome
        if (-not $nome) { continue }
        $tel = Get-Digitos $f.telefone
        $cpf = Get-Digitos $f.respostas.cpf
        if ($tel) {
            $chave = "$nome::$tel"
            if ($porNomeTelefone.ContainsKey($chave)) { Union-Grupos $pai $i $porNomeTelefone[$chave] }
            else { $porNomeTelefone[$chave] = $i }
        }
        if ($cpf) {
            $chave = "$nome::$cpf"
            if ($porNomeCpf.ContainsKey($chave)) { Union-Grupos $pai $i $porNomeCpf[$chave] }
            else { $porNomeCpf[$chave] = $i }
        }
    }

    # Usa arrays comuns do PowerShell (nao List<Object>) para os grupos -
    # List<Object> com exatamente 1 item dava "Os tipos de argumento nao
    # correspondem" mais adiante, ao envolver o grupo com @() de novo
    # (confirmado rodando contra os dados reais).
    $grupos = @{}
    for ($i = 0; $i -lt $n; $i++) {
        $r = Find-Raiz $pai $i
        if (-not $grupos.ContainsKey($r)) { $grupos[$r] = @() }
        $grupos[$r] += $fichas[$i]
    }

    return $grupos.Values
}

# Pega o valor nao vazio mais recente entre as fichas do grupo (mesma ideia
# do respostaEm ja usado em painel.contrato.$id.tsx).
function Get-CampoMaisRecente($fichasOrdenadas, [string]$campo) {
    foreach ($f in $fichasOrdenadas) {
        $v = $f.respostas.$campo
        if ($v -is [string] -and $v.Trim()) { return $v.Trim() }
    }
    return $null
}

Write-Host $(if ($Confirmar) { "Modo: GRAVANDO de verdade." } else { "Modo: dry run (nada sera gravado)." })

$fichas = @(Invoke-Api -Path "fichas?select=id,nome,telefone,respostas,cliente_id,autoriza_foto&excluida=eq.false&order=created_at.desc")
Write-Host "Fichas encontradas: $($fichas.Count)"

$comNome = @($fichas | Where-Object { Get-NomeNormalizado $_.nome })
$semNome = @($fichas | Where-Object { -not (Get-NomeNormalizado $_.nome) })
$grupos = @(Group-Fichas $comNome)

Write-Host "Pessoas distintas identificadas: $($grupos.Count)"
if ($semNome.Count -gt 0) {
    $ids = ($semNome | ForEach-Object { $_.id }) -join ", "
    Write-Host "Fichas sem nome (ficam sem cliente_id, revisar manualmente): $ids"
}

$jaTinhamCliente = @($fichas | Where-Object { $_.cliente_id }).Count
if ($jaTinhamCliente -gt 0) {
    Write-Host "$jaTinhamCliente ficha(s) ja tem cliente_id - script ignora essas e so processa o restante."
}

$criados = 0
$fichasLigadas = 0

foreach ($grupo in $grupos) {
  try {
    Write-Host "[debug] grupo: tipo=$($grupo.GetType().FullName) count=$($grupo.Count)" -ForegroundColor DarkGray

    $pendentes = @($grupo | Where-Object { -not $_.cliente_id })
    if ($pendentes.Count -eq 0) { continue }

    $ordenadas = @($grupo) # ja vem mais recente primeiro (order=created_at.desc)
    $nome = $ordenadas[0].nome
    $telefone = ($ordenadas | Where-Object { $_.telefone } | Select-Object -First 1).telefone

    $dadosCliente = [ordered]@{
        nome          = $nome
        telefone      = $telefone
        cpf           = Get-CampoMaisRecente $ordenadas "cpf"
        email         = Get-CampoMaisRecente $ordenadas "email"
        nascimento    = Get-CampoMaisRecente $ordenadas "nascimento"
        sexo          = Get-CampoMaisRecente $ordenadas "sexo"
        profissao     = Get-CampoMaisRecente $ordenadas "profissao"
        estado_civil  = Get-CampoMaisRecente $ordenadas "estadoCivil"
        cep           = Get-CampoMaisRecente $ordenadas "cep"
        endereco      = Get-CampoMaisRecente $ordenadas "endereco"
        numero        = Get-CampoMaisRecente $ordenadas "numero"
        complemento   = Get-CampoMaisRecente $ordenadas "complemento"
        cidade        = Get-CampoMaisRecente $ordenadas "cidade"
        como_conheceu = Get-CampoMaisRecente $ordenadas "comoConheceu"
        autoriza_foto = [bool]($grupo | Where-Object { $_.autoriza_foto -eq $true })
    }

    Write-Host ""
    Write-Host "- Cliente `"$nome`" ($($pendentes.Count) ficha(s) a ligar)"
    Write-Host "  $($dadosCliente | ConvertTo-Json -Compress)"

    if (-not $Confirmar) { continue }

    $criado = Invoke-Api -Path "clientes" -Method "POST" -Body $dadosCliente -Prefer "return=representation"
    $clienteId = $criado[0].id
    $criados++

    foreach ($f in $pendentes) {
        Invoke-Api -Path "fichas?id=eq.$($f.id)" -Method "PATCH" -Body @{ cliente_id = $clienteId } -Prefer "return=minimal" | Out-Null
        $fichasLigadas++
    }
  } catch {
    Write-Host "[erro no grupo] $($_.Exception.GetType().FullName): $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "  linha: $($_.InvocationInfo.ScriptLineNumber), comando: $($_.InvocationInfo.Line.Trim())" -ForegroundColor Red
    throw
  }
}

Write-Host ""
Write-Host "============================================================"
if (-not $Confirmar) {
    Write-Host "Dry run concluido. $($grupos.Count) cliente(s) seriam criados. Rode de novo com -Confirmar para gravar."
} else {
    Write-Host "Concluido: $criados cliente(s) criados, $fichasLigadas ficha(s) ligadas."
    Write-Host "Confira no Supabase antes de trocar a leitura do app para a tabela clientes."
}
