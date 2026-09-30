import "./LoginPage.css";

import LockOutlined from "@ant-design/icons/LockOutlined";
import MailOutlined from "@ant-design/icons/MailOutlined";
import WarningOutlined from "@ant-design/icons/WarningOutlined";
import Button from "antd/es/button";
import ConfigProvider from "antd/es/config-provider";
import Divider from "antd/es/divider";
import Form from "antd/es/form";
import Input from "antd/es/input";
import Typography from "antd/es/typography";
import { useState } from "react";

const LOGIN_COPY = {
    eyebrow: "CRM TINK",
    title: "Bienvenido",
    subtitle: "Inicia sesión con tu cuenta corporativa para continuar.",
    emailLabel: "Correo electrónico",
    emailPlaceholder: "usuario@roccacr.com",
    passwordLabel: "Contraseña",
    passwordPlaceholder: "Ingresa tu contraseña",
    signIn: "Ingresar",
    localDivider: "O ingresa con credenciales locales",
    microsoft: "Continuar con Microsoft",
    footerSecurity: "Acceso corporativo protegido",
    offline: "Sin conexión a Internet. Revisa tu red e inténtalo nuevamente.",
    authenticating: "Verificando credenciales...",
} as const;

const ROCCA_LOGO_SRC = "/Logo/logo2.jpg";

/**
 * Filtro mínimo para avisar un correo mal formado antes de salir del campo.
 *
 * No implementa RFC 5322. Cuando el BFF de identidad esté conectado, la
 * validez definitiva del correo la decide el API, no esta expresión.
 */
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Error de campo anunciable.
 *
 * El icono queda fuera del nombre accesible para que el lector de pantalla
 * lea solo el texto, sin repetir el gráfico.
 */
const LOGIN_ERROR_TEXT = {
    emailRequired: "Ingresa tu correo.",
    emailInvalid: "El correo no es válido.",
    passwordRequired: "Ingresa tu contraseña.",
} as const;

const LOGIN_ERROR_IDS = {
    email: "login-email-error",
    password: "login-password-error",
} as const;

const renderFieldError = (messageKey: keyof typeof LOGIN_ERROR_TEXT, errorId: string) => (
    <span id={errorId} className="login-field-error" role="alert">
        <WarningOutlined aria-hidden="true" />
        <span>{LOGIN_ERROR_TEXT[messageKey]}</span>
    </span>
);

interface LoginFormValues {
    readonly email: string;
    readonly password: string;
}

export interface LoginCredentials {
    readonly email: string;
    readonly password: string;
}

export interface LoginPageProps {
    readonly authError?: string | null;
    readonly isSubmitting?: boolean;
    readonly onLocalLogin?: (credentials: LoginCredentials) => Promise<void>;
    readonly onMicrosoftLogin?: () => Promise<void>;
}

type CredentialFieldName = "email" | "password";

type LoginErrorKey = keyof typeof LOGIN_ERROR_TEXT;

type FieldErrors = Partial<Record<CredentialFieldName, LoginErrorKey>>;

/**
 * Orden visual del formulario.
 *
 * También es el orden de foco: si correo y contraseña fallan juntos, el
 * usuario vuelve al primero, no al último campo que editó.
 */
const CREDENTIAL_FIELD_ORDER: readonly CredentialFieldName[] = ["email", "password"];

const validateEmail = (email: string | undefined): LoginErrorKey | undefined => {
    const normalizedEmail = email?.trim() ?? "";

    if (!normalizedEmail) {
        return "emailRequired";
    }

    return EMAIL_PATTERN.test(normalizedEmail) ? undefined : "emailInvalid";
};

const validatePassword = (password: string | undefined): LoginErrorKey | undefined => (password ? undefined : "passwordRequired");

const FIELD_VALIDATORS = {
    email: validateEmail,
    password: validatePassword,
} as const;

const validateCredentials = (values: LoginFormValues): FieldErrors => {
    const nextErrors: FieldErrors = {};

    for (const fieldName of CREDENTIAL_FIELD_ORDER) {
        const messageKey = FIELD_VALIDATORS[fieldName](values[fieldName]);

        if (messageKey) {
            nextErrors[fieldName] = messageKey;
        }
    }

    return nextErrors;
};

/**
 * Pantalla de autenticación BFF.
 *
 * La UI nunca recibe ni guarda tokens. El submit local y Microsoft delegan en
 * el API de identidad, que crea/renueva cookies HttpOnly y valida CSRF.
 */
// eslint-disable-next-line complexity -- Ant Design form handlers keep the approved login UX in one component.
export function LoginPage({ authError = null, isSubmitting = false, onLocalLogin, onMicrosoftLogin }: LoginPageProps) {
    const [form] = Form.useForm<LoginFormValues>();
    const [statusMessage, setStatusMessage] = useState<string | null>(null);
    const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

    /**
     * Borra el error cuando el campo ya es válido.
     *
     * Dejar `undefined` conservaría la entrada y Ant Design seguiría pintando
     * el campo en error.
     */
    const setCredentialFieldError = (fieldName: CredentialFieldName, messageKey: LoginErrorKey | undefined): void => {
        setFieldErrors((currentErrors) => {
            const nextErrors = { ...currentErrors };

            if (messageKey) {
                nextErrors[fieldName] = messageKey;
                return nextErrors;
            }

            const { [fieldName]: _removedError, ...remainingErrors } = nextErrors;
            return remainingErrors;
        });
    };

    const handleCredentialBlur = (fieldName: CredentialFieldName): void => {
        const values = form.getFieldsValue();
        setCredentialFieldError(fieldName, FIELD_VALIDATORS[fieldName](values[fieldName]));
    };

    /**
     * Revalida solo el campo que acaba de cambiar.
     *
     * Un error de contraseña se mantiene mientras el usuario corrige el correo.
     */
    const clearResolvedFieldError = (changedValues: Partial<LoginFormValues>, values: LoginFormValues): void => {
        for (const fieldName of CREDENTIAL_FIELD_ORDER) {
            if (fieldName in changedValues && fieldErrors[fieldName]) {
                setCredentialFieldError(fieldName, FIELD_VALIDATORS[fieldName](values[fieldName]));
            }
        }
    };

    /**
     * Enfoca el primer campo inválido después del commit de React.
     *
     * `requestAnimationFrame` espera a que la alerta ya esté en el DOM, para
     * que el lector anuncie el campo y su error juntos.
     */
    const focusFirstInvalidField = (errors: FieldErrors): void => {
        const firstInvalidField = CREDENTIAL_FIELD_ORDER.find((fieldName) => errors[fieldName]);

        if (firstInvalidField) {
            window.requestAnimationFrame(() => {
                document.getElementById(firstInvalidField)?.focus();
            });
        }
    };

    /**
     * Único camino de envío de este corte visual.
     *
     * El boton y la tecla Enter llaman esta misma ruta. En este corte visual
     * no usamos reglas internas de Ant Design porque todavia no hay API ni
     * contrato de submit real; la validacion vive aqui para controlar cuándo
     * aparecen y se limpian los errores.
     */
    const handleCredentialSubmit = async (): Promise<void> => {
        const values = form.getFieldsValue();
        const nextErrors = validateCredentials(values);

        setFieldErrors(nextErrors);
        focusFirstInvalidField(nextErrors);

        if (Object.keys(nextErrors).length > 0) {
            return;
        }

        if (!navigator.onLine) {
            setStatusMessage(LOGIN_COPY.offline);
            return;
        }

        if (!onLocalLogin) {
            setStatusMessage(null);
            return;
        }

        setStatusMessage(LOGIN_COPY.authenticating);

        try {
            await onLocalLogin({
                email: values.email.trim(),
                password: values.password,
            });
            setStatusMessage(null);
        } catch {
            setStatusMessage(null);
        }
    };

    const submitCredentials = (): void => {
        void handleCredentialSubmit();
    };

    const handleMicrosoftLogin = (): void => {
        if (!onMicrosoftLogin) {
            return;
        }

        void onMicrosoftLogin();
    };

    return (
        <ConfigProvider
            theme={{
                token: {
                    borderRadius: 14,
                    colorPrimary: "#111318",
                    controlHeight: 46,
                    fontFamily: '"Aptos", "Segoe UI", system-ui, sans-serif',
                },
            }}
        >
            <main className="login-shell" aria-labelledby="login-title">
                <section className="login-card">
                    <div className="login-card__body">
                        <img className="login-logo" src={ROCCA_LOGO_SRC} width="1121" height="405" alt="ROCCA Development Group" fetchPriority="high" />

                        <Typography.Title id="login-title" className="login-title" level={1}>
                            {LOGIN_COPY.title}
                        </Typography.Title>
                        <Typography.Text className="login-subtitle">{LOGIN_COPY.subtitle}</Typography.Text>

                        <div className="login-provider-grid" aria-label="Proveedor principal de autenticación corporativa">
                            <Button className="login-provider-button login-provider-button--primary" type="primary" loading={isSubmitting} onClick={handleMicrosoftLogin} block>
                                <span className="login-microsoft-logo" aria-hidden="true">
                                    <span />
                                    <span />
                                    <span />
                                    <span />
                                </span>
                                {LOGIN_COPY.microsoft}
                            </Button>
                        </div>

                        <Divider className="login-divider">{LOGIN_COPY.localDivider}</Divider>

                        {authError ? (
                            <div className="login-status-message login-status-message--error" role="alert" aria-live="assertive">
                                {authError}
                            </div>
                        ) : null}

                        {statusMessage ? (
                            <div className="login-status-message login-status-message--info" role="status" aria-live="polite">
                                {statusMessage}
                            </div>
                        ) : null}

                        <Form<LoginFormValues> form={form} className="login-form" layout="vertical" requiredMark={false} onValuesChange={clearResolvedFieldError}>
                            <Form.Item label={LOGIN_COPY.emailLabel} name="email" validateStatus={fieldErrors.email ? "error" : ""} help={fieldErrors.email ? renderFieldError(fieldErrors.email, LOGIN_ERROR_IDS.email) : null}>
                                <Input
                                    aria-describedby={fieldErrors.email ? LOGIN_ERROR_IDS.email : undefined}
                                    aria-invalid={Boolean(fieldErrors.email)}
                                    aria-label="Correo administrativo"
                                    prefix={<MailOutlined aria-hidden="true" />}
                                    placeholder={LOGIN_COPY.emailPlaceholder}
                                    type="email"
                                    inputMode="email"
                                    autoComplete="username"
                                    autoCapitalize="off"
                                    spellCheck={false}
                                    disabled={isSubmitting}
                                    onPressEnter={submitCredentials}
                                    onBlur={() => {
                                        handleCredentialBlur("email");
                                    }}
                                />
                            </Form.Item>

                            <Form.Item label={LOGIN_COPY.passwordLabel} name="password" validateStatus={fieldErrors.password ? "error" : ""} help={fieldErrors.password ? renderFieldError(fieldErrors.password, LOGIN_ERROR_IDS.password) : null}>
                                <Input.Password
                                    aria-describedby={fieldErrors.password ? LOGIN_ERROR_IDS.password : undefined}
                                    aria-invalid={Boolean(fieldErrors.password)}
                                    aria-label="Contraseña"
                                    prefix={<LockOutlined aria-hidden="true" />}
                                    placeholder={LOGIN_COPY.passwordPlaceholder}
                                    autoComplete="current-password"
                                    disabled={isSubmitting}
                                    onPressEnter={submitCredentials}
                                    onBlur={() => {
                                        handleCredentialBlur("password");
                                    }}
                                />
                            </Form.Item>

                            <Button className="login-submit" htmlType="button" loading={isSubmitting} onClick={submitCredentials} block>
                                {LOGIN_COPY.signIn}
                            </Button>
                        </Form>
                    </div>

                    <footer className="login-footer">
                        <span>{LOGIN_COPY.footerSecurity}</span>
                    </footer>
                </section>
            </main>
        </ConfigProvider>
    );
}
