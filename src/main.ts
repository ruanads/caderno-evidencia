import './estilo.css';
import * as db from './armazenamento/db.ts';
import { estado } from './tela/estado.ts';
import { mostrarCaderno } from './tela/caderno.ts';
import { mostrarInicio } from './tela/inicio.ts';

function irParaCaderno(): void {
  mostrarCaderno(irParaInicio);
}

function irParaInicio(): void {
  mostrarInicio(estado.caderno, () => {
    if (estado.caderno) irParaCaderno();
  });
}

async function iniciar(): Promise<void> {
  estado.armazenamentoOk = await db.abrir();
  estado.caderno = await db.lerCaderno();
  estado.evidencias = await db.lerEvidencias();
  irParaInicio();
}

void iniciar();
