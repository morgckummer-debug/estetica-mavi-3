import { Sparkles, HeartHandshake, ShieldCheck } from "lucide-react";
import { motion } from "motion/react";

const items = [
  {
    icon: Sparkles,
    title: "Tecnologia de ponta",
    desc: "Equipamentos de última geração — como o laser Ácrus Triple Wave — para resultados consistentes e seguros.",
  },
  {
    icon: HeartHandshake,
    title: "Atendimento humanizado",
    desc: "Escutamos sua história e desenhamos um caminho de cuidado feito sob medida para o seu momento.",
  },
  {
    icon: ShieldCheck,
    title: "Profissional especializada",
    desc: "Cuidado individualizado conduzido por fisioterapeuta especializada, com protocolos validados e constante atualização nas técnicas mais avançadas da estética.",
  },
];

export function Differentials() {
  return (
    <section className="py-8 lg:py-14">
      <div className="mx-auto max-w-7xl px-6 lg:px-10">
        <div className="grid md:grid-cols-3 gap-8 lg:gap-12">
          {items.map((item, i) => (
            <motion.div
              key={item.title}
              initial={{ opacity: 1, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: i * 0.1 }}
              className="text-center md:text-left"
            >
              <div className="inline-flex w-14 h-14 rounded-2xl bg-lavender-soft items-center justify-center text-primary mb-6">
                <item.icon className="h-6 w-6" />
              </div>
              <h3 className="font-display text-2xl text-primary mb-3">{item.title}</h3>
              <p className="text-foreground/70 leading-relaxed">{item.desc}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}