/**
 * Candado de entorno compartido: solo la Sandbox autorizada puede ejecutar los scripts del CRM.
 * No hace: no decide que responder cuando el candado falla; cada punto de entrada lo traduce a su contrato.
 *
 * @NApiVersion 2.1
 * @NModuleScope SameAccount
 */
define(["N/runtime"], (runtime) => {
    "use strict";

    /** Unica cuenta donde los scripts del CRM pueden responder (constante centralizada, sin otros IDs de cuenta). */
    const SANDBOX_ACCOUNT = "4552704_SB1";

    /**
     * Cuenta Y tipo de entorno exactos: evita responder si el script se despliega en produccion por error.
     * @returns {boolean} true solo en la Sandbox autorizada.
     */
    function isAuthorizedSandbox() {
        return runtime.accountId === SANDBOX_ACCOUNT && runtime.envType === runtime.EnvType.SANDBOX;
    }

    return Object.freeze({ SANDBOX_ACCOUNT, isAuthorizedSandbox });
});
