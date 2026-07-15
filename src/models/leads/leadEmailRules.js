const normalizeEmail = (value) => String(value || "").trim().toLowerCase();

const normalizeRecipients = (recipients) => [...new Set(
    (Array.isArray(recipients) ? recipients : [recipients])
        .map(normalizeEmail)
        .filter(Boolean),
)];

const shouldSendIndividualReport = (asesor, managementRecipients) => {
    const advisorEmail = normalizeEmail(asesor?.vendedor_email);
    return Boolean(advisorEmail)
        && !normalizeRecipients(managementRecipients).includes(advisorEmail);
};

module.exports = {
    normalizeEmail,
    normalizeRecipients,
    shouldSendIndividualReport,
};
