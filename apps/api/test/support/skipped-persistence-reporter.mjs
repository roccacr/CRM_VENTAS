// Avisa al final de la corrida cuantos tests de persistencia (MySQL/SQL local) se omitieron por no tener su variable activada.
// Evita el falso "todo paso": esos tests son los que verifican transacciones, bloqueos y migraciones reales.
export default class SkippedPersistenceReporter {
    onTestRunEnd(testModules) {
        let skippedTests = 0;
        const skippedFiles = [];
        for (const module of testModules) {
            let skippedInFile = 0;
            for (const test of module.children.allTests()) {
                if (test.result().state === "skipped") skippedInFile += 1;
            }
            if (skippedInFile > 0) skippedFiles.push(module.moduleId);
            skippedTests += skippedInFile;
        }
        if (skippedTests === 0) return;
        const persistence = skippedFiles.filter((file) => /(mysql|local-sql)/i.test(file)).length;
        console.warn(`\n[AVISO] ${skippedTests} tests omitidos en ${skippedFiles.length} archivos (${persistence} de persistencia MySQL/SQL local).`);
        console.warn("[AVISO] Estos tests NO se ejecutaron: la logica SQL real quedo sin verificar. Use `pnpm test:mysql:ci` o active la variable de cada suite.\n");
    }
}
