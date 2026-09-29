import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

// O build junta HTML, CSS e JS num unico dist/index.html. Assim ele abre com
// duplo clique (file://), sem servidor: o navegador bloqueia scripts em
// modulos separados quando a pagina vem do disco.
export default defineConfig({
  base: './',
  plugins: [viteSingleFile()],
  build: { target: 'es2022' },
});
