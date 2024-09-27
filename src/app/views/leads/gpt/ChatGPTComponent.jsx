import React, { useState } from "react";

function ChatGPTComponent() {
    const [input, setInput] = useState("");
    const [response, setResponse] = useState("");
    const [error, setError] = useState("");

    const handleSubmit = async (e) => {
        e.preventDefault();

        // Clave API de OpenAI (usa la tuya, no expongas esta en producción)
        const apiKey = "sk-FeqAICbaDvqE1kJR0Sv5xvZbkVfyAtXtAwPtL-bW4_T3BlbkFJHE2-5kNm_278Q1fl-f2wteRcCLLaAK9DWbLD7rtNsA";

        const requestOptions = {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
                model: "gpt-3.5-turbo", // Cambia a "gpt-4" si tienes acceso
                messages: [{ role: "user", content: input }],
            }),
        };

        try {
            const res = await fetch("https://api.openai.com/v1/chat/completions", requestOptions);

            // Verificamos si la respuesta HTTP fue exitosa
            if (!res.ok) {
                throw new Error(`Error en la solicitud: ${res.status}`);
            }

            const data = await res.json();

            // Verificamos si hay datos en la respuesta
            if (data.choices && data.choices.length > 0) {
                setResponse(data.choices[0].message.content);
                setError(""); // Limpiamos el mensaje de error si todo está bien
            } else {
                setError("La respuesta no tiene el formato esperado.");
            }
        } catch (error) {
            console.error("Error fetching data from OpenAI", error);
            setError(error.message);
        }
    };

    return (
        <div>
            <form onSubmit={handleSubmit}>
                <input type="text" value={input} onChange={(e) => setInput(e.target.value)} placeholder="Escribe algo para ChatGPT" />
                <button type="submit">Enviar</button>
            </form>
            <div>
                <h3>Respuesta:</h3>
                {response && <p>{response}</p>}
                {error && <p style={{ color: "red" }}>{error}</p>}
            </div>
        </div>
    );
}

export default ChatGPTComponent;
