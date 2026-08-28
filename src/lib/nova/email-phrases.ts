/**
 * Banco de frases em pt-BR pro gerador de e-mail por template
 * (email-template.ts). Desenhado pra cobrir o mesmo tom que o prompt do
 * Gemini exigia: direto, sem bajulação/clichê, sem flexão de gênero, nunca
 * inventa link. Cada variante é uma função — devolve `null` quando não se
 * aplica ao contexto (ex: precisa de headline e o perfil não tem), e o
 * gerador filtra antes de sortear.
 */

export type PhraseContext = {
  nome: string;
  empresa: string;
  cargo: string;
  headline: string;
  summary: string;
  github: string;
  site: string;
  /** Skills que batem, já unidas em português natural ("Python, FastAPI e PostgreSQL"). */
  skillsMatchText: string;
  /** Primeira skill que bate, isolada — usada nas variantes "top + resto". */
  skillTop: string;
  /** Demais skills que batem (a partir da 2ª), unidas — vazio se só há 1. */
  skillsRestText: string;
  /** Skills parciais, já unidas em português natural. */
  skillsPartialText: string;
};

export type Phrase = (ctx: PhraseContext) => string | null;

export const OPENING_WITH_COMPANY: Phrase[] = [
  (c) => `Olá, time da ${c.empresa}!\n\nVi a vaga de ${c.cargo} e ela conversa direto com o que eu faço hoje.`,
  (c) =>
    `Oi, pessoal da ${c.empresa}!\n\nEncontrei a vaga de ${c.cargo} e vim me candidatar — o que está descrito ali é bem o meu dia a dia.`,
  (c) =>
    c.headline
      ? `Olá! Escrevo por causa da vaga de ${c.cargo} na ${c.empresa}.\n\nTrabalho hoje como ${c.headline}, então li a descrição já reconhecendo o terreno.`
      : null,
  (c) => `Olá, time da ${c.empresa}. Tudo certo?\n\nVim pela vaga de ${c.cargo}. Vou ser direto sobre por que faz sentido.`,
  (c) =>
    `Oi! Meu nome é ${c.nome} e vi que vocês estão com a vaga de ${c.cargo} aberta na ${c.empresa}.\n\nÉ exatamente o tipo de posição que estou procurando agora.`,
  (c) =>
    `Olá, ${c.empresa}!\n\nLi a descrição da vaga de ${c.cargo} inteira antes de escrever, e não é o caso de disparar candidatura no automático: o escopo é o que venho fazendo.`,
  (c) => `Olá!\n\nA vaga de ${c.cargo} na ${c.empresa} apareceu para mim esta semana e resolvi me candidatar.`,
  (c) => `Oi, time da ${c.empresa}!\n\nSobre a vaga de ${c.cargo}: acho que dá para ir direto ao ponto do que eu trago.`,
];

export const OPENING_NO_COMPANY: Phrase[] = [
  (c) => `Olá!\n\nVi a vaga de ${c.cargo} e ela conversa direto com o que eu faço hoje.`,
  (c) => `Olá, time de recrutamento!\n\nEscrevo por causa da vaga de ${c.cargo} — vim me candidatar.`,
  (c) => `Oi, pessoal!\n\nEncontrei o anúncio da vaga de ${c.cargo} e a descrição bateu com o meu dia a dia.`,
  (c) => `Olá! Meu nome é ${c.nome} e estou me candidatando à vaga de ${c.cargo}.`,
  (c) =>
    c.headline
      ? `Olá, tudo certo?\n\nVim pela vaga de ${c.cargo}. Sou ${c.headline} e o escopo do anúncio é o que já faço.`
      : null,
  (c) => `Oi!\n\nLi o anúncio da vaga de ${c.cargo} e queria me colocar como opção — explico em três parágrafos.`,
  (c) =>
    `Olá!\n\nVaga de ${c.cargo}: li a descrição com calma e é o tipo de trabalho que venho fazendo, então vim me candidatar.`,
  (c) => `Olá, time!\n\nEscrevo sobre a vaga de ${c.cargo}, que apareceu para mim esta semana.`,
];

export const SKILLS_MATCH: Phrase[] = [
  (c) => `No dia a dia trabalho com ${c.skillsMatchText} — que é boa parte do que vocês pedem.`,
  (c) => `O que a vaga lista cruza com o que eu uso em produção: ${c.skillsMatchText}.`,
  (c) =>
    `${c.skillsMatchText} é o que venho usando de forma consistente nos últimos projetos, não em prova de conceito: em sistema rodando, com gente do outro lado.`,
  (c) => `Da lista de requisitos, é em ${c.skillsMatchText} que eu tenho estrada de verdade.`,
  (c) => (c.headline ? `Hoje sou ${c.headline} e minha rotina gira em torno de ${c.skillsMatchText}.` : null),
  (c) =>
    c.summary
      ? `${c.summary}\n\nNa prática, isso quer dizer ${c.skillsMatchText} — que é o núcleo do que a vaga pede.`
      : null,
  (c) =>
    c.skillsRestText
      ? `${c.skillTop} é a base do que eu faço; junto dela, ${c.skillsRestText} aparecem no mesmo projeto, não em frentes separadas.`
      : null,
  (c) => `Sobre os requisitos técnicos: ${c.skillsMatchText} eu já levei de decisão de arquitetura até deploy e manutenção.`,
];

/**
 * Suprimir este parágrafo quando: skillsPartialText vazio; as skills parciais
 * já apareceram em skillsMatchText; só há 1 skill de match (o e-mail vira
 * "sei pouco e o resto estou aprendendo"); ou a parcial é o requisito central
 * da vaga. Essa lógica de supressão vive no gerador (email-template.ts), não
 * aqui — as variantes abaixo assumem que já faz sentido incluir o parágrafo.
 */
export const SKILLS_PARTIAL: Phrase[] = [
  (c) => `${c.skillsPartialText} são áreas onde já entreguei e quero me aprofundar.`,
  (c) =>
    `Não vou dizer que domino ${c.skillsPartialText} — já usei em projeto e é justamente para onde quero puxar meu trabalho agora.`,
  (c) => `Tenho contato com ${c.skillsPartialText}, ainda em nível inicial. Prefiro deixar isso claro do que vender o que não tenho.`,
  (c) =>
    `${c.skillsPartialText} é o pedaço onde eu tenho menos estrada, mas por vir da mesma família do que já uso, a curva é curta.`,
  (c) =>
    `Sobre ${c.skillsPartialText}: já resolvi problema parecido com ferramenta vizinha, então parto de algum lugar — mas é área em construção, não domínio.`,
  (c) => `O que ainda não é meu ponto forte na vaga: ${c.skillsPartialText}. É onde estou investindo tempo fora do trabalho.`,
  (c) =>
    `Se ${c.skillsPartialText} for requisito duro, aí eu chego como quem está aprendendo — com base para aprender rápido, mas aprendendo.`,
];

export const CLOSING: Phrase[] = [
  () => `Anexei meu CV. Fico à disposição para uma conversa quando fizer sentido.`,
  () => `O CV vai anexado, com o detalhe de cada projeto. Se quiserem conversar, é só chamar.`,
  () => `Deixei o CV em anexo. Tenho disponibilidade para uma conversa nesta ou na próxima semana.`,
  () => `Segue o CV anexado. Qualquer dúvida sobre um projeto específico, posso detalhar por aqui mesmo.`,
  () => `Anexei o currículo. Se o perfil fizer sentido para a etapa seguinte, é só me dizer o melhor formato.`,
  () => `Coloquei o CV em anexo. Se quiserem entender algo antes de marcar conversa, respondo por e-mail sem problema.`,
  () => `O CV está anexado a este e-mail. Fico no aguardo do retorno de vocês.`,
  () => `Anexei meu CV. Obrigado pelo tempo de leitura — e se fizer sentido, conversamos.`,
];

export const SIGNATURE: Phrase[] = [
  (c) => `Abraço,\n${c.nome}`,
  (c) => `Obrigado,\n${c.nome}`,
  (c) => `Atenciosamente,\n${c.nome}`,
  (c) => `Até mais,\n${c.nome}`,
  (c) => (c.github ? `Abraço,\n${c.nome}\n${c.github}` : null),
  (c) => {
    const lines = [c.github && `GitHub: ${c.github}`, c.site && `Site: ${c.site}`].filter(
      (l): l is string => !!l,
    );
    return lines.length ? `Obrigado,\n${c.nome}\n${lines.join("\n")}` : null;
  },
  (c) => (c.headline ? `Fico no aguardo,\n${c.nome} — ${c.headline}` : null),
  (c) => (c.site ? `Abraço,\n${c.nome}\nMeus projetos: ${c.site}` : null),
];

export const SUBJECT: Phrase[] = [
  (c) => `Candidatura — ${c.cargo}`,
  (c) => `${c.cargo} — candidatura de ${c.nome}`,
  (c) => (c.empresa ? `Candidatura para ${c.cargo} na ${c.empresa}` : null),
  (c) => `${c.nome} — ${c.cargo}`,
  (c) => `Vaga de ${c.cargo}: candidatura + CV`,
];
