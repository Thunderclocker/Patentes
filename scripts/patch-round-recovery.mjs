import fs from 'node:fs';

const target = process.argv[2] || 'control_de_estacionamiento.html';
const source = fs.readFileSync(target, 'utf8');

const uiOld = `                    <button onclick="nuevaRonda()" class="bg-rose-950/40 hover:bg-rose-900/60 border border-rose-800/50 text-rose-200 text-xs font-bold py-2 px-3.5 rounded-lg flex items-center gap-1.5 transition-all active:scale-95" title="Iniciar Nueva Ronda (Borra los registros locales)">
                        <i data-lucide="trash-2" class="w-4 h-4 text-rose-400"></i>
                        Nueva Ronda
                    </button>`;

const uiNew = `                    <button onclick="restaurarUltimaRonda()" class="bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-bold py-2 px-3.5 rounded-lg flex items-center gap-1.5 transition-all active:scale-95" title="Restaurar la última ronda cerrada">
                        <i data-lucide="history" class="w-4 h-4 text-amber-400"></i>
                        Restaurar
                    </button>
                    <button onclick="nuevaRonda()" class="bg-rose-950/40 hover:bg-rose-900/60 border border-rose-800/50 text-rose-200 text-xs font-bold py-2 px-3.5 rounded-lg flex items-center gap-1.5 transition-all active:scale-95" title="Iniciar Nueva Ronda (Borra los registros locales)">
                        <i data-lucide="trash-2" class="w-4 h-4 text-rose-400"></i>
                        Nueva Ronda
                    </button>`;

const logicOld = `        // Iniciar nueva ronda limpiando los registros locales
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

        // Función del cartel de alerta personalizado`;

const logicNew = `        // Iniciar nueva ronda preservando primero una copia recuperable
        function nuevaRonda() {
            if (registros.length === 0) {
                mostrarToast("El historial ya está vacío");
                return;
            }
            if (confirm("¿Estás seguro de iniciar una nueva ronda?\\nLa ronda actual quedará disponible como última ronda cerrada.")) {
                const backup = JSON.stringify(registros);
                localStorage.setItem('ultima_ronda_estacionamiento', backup);
                const backupVerificado = localStorage.getItem('ultima_ronda_estacionamiento');
                if (backupVerificado !== backup) {
                    mostrarToast("No se pudo guardar la copia de seguridad");
                    return;
                }
                registros = [];
                localStorage.removeItem('ronda_estacionamiento');
                renderizarRegistros();
                mostrarToast("¡Nueva ronda iniciada!");
            }
        }

        function restaurarUltimaRonda() {
            const backup = localStorage.getItem('ultima_ronda_estacionamiento');
            if (!backup) {
                mostrarToast("No hay una ronda cerrada para restaurar");
                return;
            }

            const rondaActiva = localStorage.getItem('ronda_estacionamiento');
            let activa = [];
            try {
                activa = rondaActiva ? JSON.parse(rondaActiva) : [];
            } catch (e) {
                mostrarToast("La ronda activa no se puede validar");
                return;
            }
            if (Array.isArray(activa) && activa.length > 0) {
                mostrarToast("No se puede restaurar con una ronda activa");
                return;
            }

            let recuperada;
            try {
                recuperada = JSON.parse(backup);
            } catch (e) {
                mostrarToast("La copia de la última ronda está dañada");
                return;
            }
            if (!Array.isArray(recuperada) || recuperada.length === 0) {
                mostrarToast("La última ronda guardada está vacía");
                return;
            }

            localStorage.setItem('ronda_estacionamiento', backup);
            registros = recuperada;
            renderizarRegistros();
            mostrarToast("Última ronda restaurada");
        }

        // Función del cartel de alerta personalizado`;

function exactlyOnce(haystack, needle, label) {
    const first = haystack.indexOf(needle);
    if (first === -1) throw new Error(`No se encontró el ancla exacta: ${label}`);
    if (haystack.indexOf(needle, first + needle.length) !== -1) {
        throw new Error(`El ancla aparece más de una vez: ${label}`);
    }
}

exactlyOnce(source, uiOld, 'botón Nueva Ronda');
exactlyOnce(source, logicOld, 'lógica nuevaRonda');

const patched = source.replace(uiOld, uiNew).replace(logicOld, logicNew);

if (!patched.includes("localStorage.setItem('ultima_ronda_estacionamiento', backup)")) throw new Error('Falta escritura de backup');
if (!patched.includes("localStorage.getItem('ultima_ronda_estacionamiento')")) throw new Error('Falta readback/restauración del backup');
if (!patched.includes('function restaurarUltimaRonda()')) throw new Error('Falta restaurarUltimaRonda');
if (patched === source) throw new Error('El parche no produjo cambios');

fs.writeFileSync(target, patched, 'utf8');
console.log(`Parche aplicado y validado: ${target}`);
