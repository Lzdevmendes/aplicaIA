/**
 * Dicionário estático de skills técnicas, usado pelo parser determinístico da
 * vaga colada (job-parser.ts) pra achar requisitos no texto e comparar com o
 * perfil do candidato — sem chamar o Gemini.
 *
 * É finito por natureza: uma stack fora daqui não vira nem "match" nem "miss",
 * simplesmente não é reconhecida. Precisa de manutenção manual conforme
 * stacks novas aparecerem nas vagas dos usuários.
 */

/** Nome canônico → grafias alternativas que aparecem em vagas coladas. */
export const SKILL_ALIASES: Record<string, string[]> = {
  // "js"/"ts" ficam de fora de propósito: "js" bate dentro de "Node.js",
  // "Vue.js", "Next.js", "Nuxt.js" (todos têm ".js" no meio, e "." não conta
  // como borda de palavra) — colisão pior que perder o alias curto.
  "Node.js": ["node", "nodejs"],
  "Next.js": ["nextjs"],
  "Vue.js": ["vue", "vuejs"],
  "Nuxt.js": ["nuxt", "nuxtjs"],
  PostgreSQL: ["postgres", "postgresql"],
  MongoDB: ["mongo"],
  Kubernetes: ["k8s"],
  "CI/CD": ["ci cd", "continuous integration", "continuous delivery"],
  "Tailwind CSS": ["tailwind"],
  "Ruby on Rails": ["rails"],
  "ASP.NET": ["asp net", ".net", "dotnet"],
  "Spring Boot": ["spring"],
  "React Native": ["react-native"],
  GraphQL: ["graph ql"],
  "Machine Learning": ["ml"],
  "Inteligência Artificial": ["ia", "ai"],
  "Power BI": ["powerbi"],
  DevOps: ["dev ops"],
  "Google Cloud Platform": ["gcp", "google cloud"],
  AWS: ["amazon web services"],
  Azure: ["microsoft azure"],
  OOP: ["poo", "programação orientada a objetos", "object oriented"],
  "GitHub Actions": ["github actions"],
  "GitLab CI": ["gitlab ci"],
};

/**
 * Nomes canônicos reconhecidos no texto da vaga, na ordem em que fazem
 * sentido pra varredura (não precisa ser alfabética).
 */
export const KNOWN_SKILLS: string[] = [
  // Linguagens
  "JavaScript",
  "TypeScript",
  "Python",
  "Java",
  "C#",
  "C++",
  "Go",
  "Rust",
  "Ruby",
  "PHP",
  "Swift",
  "Kotlin",
  "Scala",
  "Elixir",
  "Dart",
  "SQL",

  // Front-end
  "React",
  "Vue.js",
  "Angular",
  "Svelte",
  "Next.js",
  "Nuxt.js",
  "HTML",
  "CSS",
  "Sass",
  "Tailwind CSS",
  "Redux",
  "jQuery",

  // Back-end / frameworks
  "Node.js",
  "Express",
  "FastAPI",
  "Django",
  "Flask",
  "Spring Boot",
  "ASP.NET",
  "Ruby on Rails",
  "Laravel",
  "NestJS",
  "GraphQL",
  "REST",
  "gRPC",

  // Mobile
  "React Native",
  "Flutter",
  "SwiftUI",
  "Android",
  "iOS",

  // Bancos de dados
  "PostgreSQL",
  "MySQL",
  "MongoDB",
  "Redis",
  "SQLite",
  "Oracle",
  "SQL Server",
  "DynamoDB",
  "Cassandra",
  "Elasticsearch",
  "Firebase",
  "Supabase",

  // Dados / ML
  "Pandas",
  "NumPy",
  "TensorFlow",
  "PyTorch",
  "Scikit-learn",
  "Spark",
  "Airflow",
  "dbt",
  "ETL",
  "Machine Learning",
  "Inteligência Artificial",
  "Power BI",
  "Tableau",

  // Cloud / infra
  "AWS",
  "Google Cloud Platform",
  "Azure",
  "Docker",
  "Kubernetes",
  "Terraform",
  "Ansible",
  "CI/CD",
  "Jenkins",
  "GitHub Actions",
  "GitLab CI",
  "Nginx",
  "Linux",
  "DevOps",

  // Mensageria
  "Kafka",
  "RabbitMQ",
  "SQS",
  "WebSocket",

  // Testes / QA
  "Jest",
  "Cypress",
  "Playwright",
  "Selenium",
  "PyTest",
  "JUnit",
  "TDD",
  "QA",

  // Metodologia / ferramentas
  "Git",
  "Scrum",
  "Agile",
  "Kanban",
  "Jira",
  "Figma",
  "Microservices",
  "OOP",
  "OAuth",
  "JWT",
  "Webpack",
  "Vite",
];

/**
 * Pares adjacentes pro veredito "parcial" — deliberadamente modesto, mesmo
 * espírito dos exemplos que já existiam no prompt do Gemini (Kafka/RabbitMQ,
 * GraphQL/REST). Simétrico: A em B implica B em A (garantido pelos testes).
 */
export const PARTIAL_ADJACENCY: Record<string, string[]> = {
  Kafka: ["RabbitMQ", "SQS"],
  RabbitMQ: ["Kafka", "SQS"],
  SQS: ["Kafka", "RabbitMQ"],

  GraphQL: ["REST"],
  REST: ["GraphQL"],

  React: ["Vue.js", "Angular"],
  "Vue.js": ["React", "Angular"],
  Angular: ["React", "Vue.js"],

  PostgreSQL: ["MySQL", "MongoDB"],
  MySQL: ["PostgreSQL", "MongoDB"],
  MongoDB: ["PostgreSQL", "MySQL"],

  AWS: ["Google Cloud Platform", "Azure"],
  "Google Cloud Platform": ["AWS", "Azure"],
  Azure: ["AWS", "Google Cloud Platform"],

  Django: ["Flask", "FastAPI"],
  Flask: ["Django", "FastAPI"],
  FastAPI: ["Django", "Flask"],

  TensorFlow: ["PyTorch"],
  PyTorch: ["TensorFlow"],

  Swift: ["Kotlin"],
  Kotlin: ["Swift"],

  "React Native": ["Flutter"],
  Flutter: ["React Native"],
};

const aliasToCanonical = new Map<string, string>();
for (const [canonical, aliases] of Object.entries(SKILL_ALIASES)) {
  for (const alias of aliases) aliasToCanonical.set(alias.toLowerCase(), canonical);
}
for (const canonical of KNOWN_SKILLS) aliasToCanonical.set(canonical.toLowerCase(), canonical);

/** Normaliza uma skill (do perfil do candidato ou da vaga) pro nome canônico, se reconhecido. */
export function toCanonicalSkill(raw: string): string {
  const key = raw.trim().toLowerCase();
  return aliasToCanonical.get(key) ?? raw.trim();
}
