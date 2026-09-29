import './estilo.css';
import * as db from './armazenamento/db.ts';
import { abrirCadernoSalvo, estado } from './tela/estado.ts';
import { mostrarCaderno } from './tela/caderno.ts';
import { mostrarInicio } from './tela/inicio.ts';

function irParaCaderno(): void {
  mostrarCaderno(() => void irParaInicio());
}

async function irParaInicio(): Promise<void> {
  const salvos = await db.listarCadernos();
  mostrarInicio(
    salvos,
    async (caderno) => {
      await abrirCadernoSalvo(caderno);
      irParaCaderno();
    },
    irParaCaderno,
  );
}

async function iniciar(): Promise<void> {
  estado.armazenamentoOk = await db.abrir();
  await irParaInicio();
}

void iniciar();
