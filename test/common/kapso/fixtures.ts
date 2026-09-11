/** Fixtures Kapso compartidos (unit + e2e). Una sola fuente de phone_number_id de prueba. */

export const TEST_PHONE_NUMBER_ID = "123456789012345";
export const TEST_PROJECT_ID = "project-1";
export const TEST_CUSTOMER_ID = "customer-1";

export const createdPhoneNumberPayload = {
    phone_number_id: TEST_PHONE_NUMBER_ID,
    project: { id: TEST_PROJECT_ID },
    customer: { id: TEST_CUSTOMER_ID },
} as const;

export const deletedPhoneNumberPayload = {
    phone_number_id: TEST_PHONE_NUMBER_ID,
} as const;
