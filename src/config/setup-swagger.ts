import { INestApplication } from "@nestjs/common";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";

/** Path de Swagger UI. El JSON queda en `${SWAGGER_PATH}-json` (Nest default). */
const SWAGGER_PATH = "api/docs";

const SWAGGER_TITLE = "API Kapso GIT";
const SWAGGER_DESCRIPTION = "API NestJS para integrar Kapso con CRM Ventas.";
const SWAGGER_VERSION = "0.1.0";

/**
 * Monta Swagger UI. Corre despues de `setGlobalPrefix`: las rutas documentadas
 * ya incluyen `/api/v1`. Playwright pega a `/api/docs` y `/api/docs-json`.
 */
export function setupSwagger(app: INestApplication): void {
    const swagger = new DocumentBuilder().setTitle(SWAGGER_TITLE).setDescription(SWAGGER_DESCRIPTION).setVersion(SWAGGER_VERSION).build();
    SwaggerModule.setup(SWAGGER_PATH, app, SwaggerModule.createDocument(app, swagger));
}
