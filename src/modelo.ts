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

export type TestCase = {
  id: string;            // ID interno curto e estavel: CT01, CT02...
  titulo: string;        // Title do Azure, completo (com o prefixo [Etapa 1], se houver)
  grupo: string;         // prefixo do titulo sem colchetes ("Etapa 1"), ou "" se nao houver
  passos: Passo[];
  status: StatusTeste;   // escolhido na tela; um passo com falha forca "bad" (ver statusEfetivo)
  observacao: string;    // "O que apareceu"
  azure: DadosAzure;
  linhasOriginais: string[][]; // linhas do CSV importado, para exportar sem perder colunas
};

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
  tarefa: string;
  testes: TestCase[];
  massa: LinhaMassa[];
  formato: FormatoCsv;
  ativo: { testeId: string; passo: number }; // passo comeca em 1
};

export type Evidencia = {
  id: string;
  testeId: string;
  passo: number;
  seq: number;
  legenda: string;
  blob: Blob;
  criadoEm: number;
};

export const CABECALHO_AZURE = [
  'ID', 'Work Item Type', 'Title', 'Test Step', 'Step Action', 'Step Expected', 'Area Path', 'Assigned To', 'State',
] as const;

// Um passo com falha derruba o teste inteiro, mesmo que alguem marque "Passou".
export function statusEfetivo(t: TestCase): StatusTeste {
  return t.passos.some((p) => p.status === 'bad') ? 'bad' : t.status;
}

export function passoQueFalhou(t: TestCase): number {
  return t.passos.findIndex((p) => p.status === 'bad') + 1; // 0 = nenhum
}
