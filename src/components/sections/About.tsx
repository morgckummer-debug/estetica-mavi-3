import { motion } from "motion/react";

export function About() {
  return (
    <section id="sobre" className="py-4 lg:py-7 relative">
      <div className="mx-auto max-w-4xl px-6 lg:px-10 text-center">
        <motion.div
          initial={{ opacity: 1, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.7 }}
        >
          <p className="text-xs tracking-[0.3em] uppercase text-primary/70 mb-6">Sobre a MAVI</p>
          <h2 className="font-display text-4xl lg:text-5xl text-primary leading-tight">
            Um espaço pensado para
            <br />
            <em className="italic font-normal text-rose">acolher, cuidar e transformar</em>.
          </h2>
          <p className="mt-8 text-lg text-foreground/70 leading-relaxed">
            Há mais de quatro anos a MAVI Centro de Estética é referência em Sete Lagoas
            por unir tecnologias de ponta, técnicas autorais e um atendimento humanizado.
            Aqui cada protocolo é desenhado para a sua história, com a precisão e o carinho
            que sua pele e seu corpo merecem.
          </p>
        </motion.div>
      </div>
    </section>
  );
}