import { INestApplication } from "@nestjs/common";
import { Test, TestingModuleBuilder } from "@nestjs/testing";

import { AppModule } from "../../../src/app.module";
import { createCorsOptions } from "../../../src/config/cors-options";
import { GLOBAL_API_PREFIX } from "../../../src/config/http.constants";
import { GLOBAL_VALIDATION_PIPE } from "../../../src/config/validation-pipe";

export type CreateE2eAppOptions = {
    /** Necesario para verificar firmas HMAC (webhooks). */
    readonly rawBody?: boolean;
    /** Overrides de providers (ConfigService, services, etc.). */
    readonly configure?: (builder: TestingModuleBuilder) => TestingModuleBuilder;
};

/**
 * Factory única de app e2e Nest.
 *
 * Misma idea que InternalTokenGuard: el bootstrap (AppModule + prefix + init)
 * vive una sola vez; cada suite solo aporta overrides de config.
 */
export async function createE2eApp(options: CreateE2eAppOptions = {}): Promise<INestApplication> {
    let builder = Test.createTestingModule({ imports: [AppModule] });

    if (options.configure) {
        builder = options.configure(builder);
    }

    const moduleRef = await builder.compile();
    const app = moduleRef.createNestApplication(options.rawBody ? { rawBody: true } : undefined);
    app.enableCors(createCorsOptions());
    app.setGlobalPrefix(GLOBAL_API_PREFIX);
    app.useGlobalPipes(GLOBAL_VALIDATION_PIPE);
    await app.init();

    return app;
}
