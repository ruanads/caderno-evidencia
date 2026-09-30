// Formato dos dados do caderno. Tudo aqui e serializavel (vai para o IndexedDB),
// exceto o Blob das evidencias, que o IndexedDB tambem guarda nativamente.

export type StatusTeste = '' | 'ok' | 'bad' | 'skip';
export type StatusPasso = '' | 'ok' | 'bad';

export type Passo = {
  acao: string;
  esperado: string;
  status: StatusPasso;
};

// Campos do Azure que nao sao editados aqui, mas precisam voltar iguais na exportacao.
export type DadosAzure = {
  id: string;
  areaPath: string;
  assignedTo: string;
  state: string;
};

// Resultado de uma rodada anterior, guardado quando o teste volta para reteste.
export type ResultadoRodada = {
  rodada: number;
  status: StatusTeste;
  passoQueFalhou: number;
  observacao: string;
};

export type TestCase = {
  id: string;            // ID interno curto e estavel: CT01, CT02...
  titulo: string;        // Title do Azure, completo (com o prefixo [Etapa 1], se houver)
  grupo: string;         // prefixo do titulo sem colchetes ("Etapa 1"), ou "" se nao houver
  passos: Passo[];
  status: StatusTeste;   // escolhido na tela; um passo com falha forca "bad" (ver statusEfetivo)
  observacao: string;    // "O que apareceu"
  azure: DadosAzure;
  linhasOriginais: string[][]; // linhas do CSV importado, para exportar sem perder colunas
  historico?: ResultadoRodada[]; // rodadas anteriores (reteste)
  bug?: string;          // numero do bug aberto quando o teste falhou (ex.: 22501)
};

// Dados da execucao para o relatorio. Todos opcionais: o que ficar vazio nao aparece.
export type DadosExecucao = {
  ambiente: string;      // dev, homologacao...
  versao: string;        // versao ou build testado
  branch: string;
  baseDados: string;
  navegadores: string[]; // so faz sentido para o NG (web); o PCR e desktop
  executor: string;
  observacoes: string;
};

export type NivelRisco = 'alto' | 'medio' | 'baixo';
export type Risco = { descricao: string; nivel: NivelRisco };

export type LinhaMassa = {
  teste: string;         // como veio no arquivo: CT03 ou o Title exato
  campo: string;
  valor: string;
  observacao: string;
  testeId: string;       // test case ligado (CT03), ou "" se ainda nao associado
};

// Como o CSV original foi gravado. Guardado para exportar byte a byte igual.
export type FormatoCsv = {
  cabecalho: string[];
  bom: boolean;
  quebra: '\r\n' | '\n';
  terminaComQuebra: boolean;
};

export type Caderno = {
  id: string;
  criadoEm: number;
  atualizadoEm: number;
  rodada: number;        // 1 na primeira execucao; +1 a cada reteste
  tarefa: string;
  testes: TestCase[];
  massa: LinhaMassa[];
  formato: FormatoCsv;
  ativo: { testeId: string; passo: number }; // passo comeca em 1
  execucao?: DadosExecucao;
  riscos?: Risco[];
};

export const EXECUCAO_VAZIA: DadosExecucao = {
  ambiente: '', versao: '', branch: '', baseDados: '', navegadores: [], executor: '', observacoes: '',
};

export type Evidencia = {
  id: string;
  cadernoId: string;
  rodada: number;
  testeId: string;
  passo: number;
  seq: number;
  legenda: string;
  blob: Blob;            // imagem atual (com anotacoes, se houver)
  original?: Blob;       // imagem como foi colada, guardada ao anotar
  criadoEm: number;
};

export const CABECALHO_AZURE = [
  'ID', 'Work Item Type', 'Title', 'Test Step', 'Step Action', 'Step Expected', 'Area Path', 'Assigned To', 'State',
] as const;

// Formato do CSV quando o caderno nasce sem arquivo: o mesmo que o Azure gera
// (BOM, CRLF, quebra no final), para a exportacao ser aceita na importacao.
export const FORMATO_PADRAO: FormatoCsv = { cabecalho: [...CABECALHO_AZURE], bom: true, quebra: '\r\n', terminaComQuebra: true };

// Test case novo, criado na tela. Area Path e Assigned To vem do teste de
// referencia (quando ha), para o CSV exportado cair no mesmo lugar do Azure.
export function testeEmBranco(id: string, referencia?: TestCase): TestCase {
  return {
    id,
    titulo: referencia?.grupo ? `[${referencia.grupo}] ` : '',
    grupo: referencia?.grupo ?? '',
    passos: [{ acao: '', esperado: '', status: '' }],
    status: '',
    observacao: '',
    azure: { id: '', areaPath: referencia?.azure.areaPath ?? '', assignedTo: referencia?.azure.assignedTo ?? '', state: 'Design' },
    linhasOriginais: [],
  };
}

// Um passo com falha derruba o teste inteiro, mesmo que alguem marque "Passou".
export function statusEfetivo(t: TestCase): StatusTeste {
  return t.passos.some((p) => p.status === 'bad') ? 'bad' : t.status;
}

export function passoQueFalhou(t: TestCase): number {
  return t.passos.findIndex((p) => p.status === 'bad') + 1; // 0 = nenhum
}
