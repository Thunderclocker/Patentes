import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const patchScript = path.resolve('scripts/patch-round-recovery.mjs');
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'estacionascan-round-recovery-'));
const target = path.join(tmpDir, 'control_de_estacionamiento.html');

const fixture = `
<div>
                    <button onclick="nuevaRonda()" class="bg-rose-950/40 hover:bg-rose-900/60 border border-rose-800/50 text-rose-200 text-xs font-bold py-2 px-3.5 rounded-lg flex items-center gap-1.5 transition-all active:scale-95" title="Iniciar Nueva Ronda (Borra los registros locales)">
                        <i data-lucide="trash-2" class="w-4 h-4 text-rose-400"></i>
                        Nueva Ronda
                    </button>
</div>
<script>
        // Iniciar nueva ronda limpiando los registros locales
        function nuevaRonda() {
            if (registros.length === 0) {
                mostrarToast("El historial ya está vacío");
                return;
            }
            if (confirm("¿Estás seguro de iniciar una nueva ronda?\\nEsto borrará todos los registros guardados en esta pantalla de forma permanente.")) {
                registros = [];
                localStorage.removeItem('ronda_estacionamiento');
                renderizarRegistros();
                mostrarToast("¡Nueva ronda iniciada!");
            }
        }

        // Función del cartel de alerta personalizado
</script>`;

try {
  fs.writeFileSync(target, fixture, 'utf8');
  const run = spawnSync(process.execPath, [patchScript, target], { encoding: 'utf8' });
  if (run.status !== 0) throw new Error(`El parche falló sobre fixture válido: ${run.stderr || run.stdout}`);

  const patched = fs.readFileSync(target, 'utf8');
  const required = [
    'function restaurarUltimaRonda()',
    "localStorage.setItem('ultima_ronda_estacionamiento', backup)",
    "localStorage.getItem('ultima_ronda_estacionamiento')",
    "if (!Array.isArray(activa) || activa.length > 0)",
    "if (!Array.isArray(recuperada) || recuperada.length === 0)",
    'Restaurar'
  ];
  for (const needle of required) {
    if (!patched.includes(needle)) throw new Error(`Falta garantía esperada: ${needle}`);
  }

  const setBackup = patched.indexOf("localStorage.setItem('ultima_ronda_estacionamiento', backup)");
  const getBackup = patched.indexOf("localStorage.getItem('ultima_ronda_estacionamiento')");
  const removeActive = patched.indexOf("localStorage.removeItem('ronda_estacionamiento')");
  if (!(setBackup >= 0 && getBackup > setBackup && removeActive > getBackup)) {
    throw new Error('Orden inseguro: backup y readback deben ocurrir antes de borrar la ronda activa');
  }

  const secondRun = spawnSync(process.execPath, [patchScript, target], { encoding: 'utf8' });
  if (secondRun.status === 0) throw new Error('El parche debe rechazar una segunda aplicación en vez de duplicar UI/lógica');

  console.log('OK: parche de recuperación validado sobre fixture y segunda aplicación rechazada.');
} finally {
  fs.rmSync(tmpDir, { recursive: true, force: true });
}
