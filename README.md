# 🌟 Aizen — Claude Workspace

[![GitHub Pages Deployment](https://img.shields.io/badge/GitHub%20Pages-Live-success?style=for-the-badge&logo=github)](https://oruzai.github.io/aizen-claude-chat/)

**Aizen** es un cliente web estático de Claude diseñado para ofrecer una experiencia cercana a la interfaz original de Claude en distribución, comportamiento del chat, compositor, mensajes, archivos y respuestas extensas.

---

## 🚀 Demo En Vivo

Accede a la aplicación en GitHub Pages:  
👉 **[https://oruzai.github.io/aizen-claude-chat/](https://oruzai.github.io/aizen-claude-chat/)**

---

## ✨ Correcciones y Funcionalidades Refinadas

- ⏱️ **Contador de Pensamiento Monotónico Exacto**:
  - Medición precisa congelada en el instante exacto en que llega el primer fragmento de texto (`thinkingFrozenMs = performance.now() - thinkingStartedAt`).
  - No suma el tiempo de transmisión posterior. Si el pensamiento concluyó a los 4 segundos, el mensaje final mostrará exactamente `Pensó durante 4 s`.
- 💬 **Barra de Acciones Discreta en Finalización**:
  - Las acciones (Copiar, Descargar, Regenerar) se ocultan durante el pensamiento y transmisión, y aparecen únicamente cuando la respuesta está completada.
  - Iconos limpios con tooltips discretos y área táctil optimizada (40px x 40px).
- 🛑 **Botón Detener Confiable**:
  - Detención inmediata mediante `AbortController` y `reader.cancel()` activo durante pensamiento, streaming o continuaciones sin bloquear el compositor.
- 📄 **Envío de PDF y Estado del Botón Enviar**:
  - Botón Enviar activo al adjuntar un PDF listo (incluso sin texto escrito).
  - Envío directo como bloque `document` Base64.
- 🎛️ **Interacción de Selectores y Haiku 4.5**:
  - Eliminación de resaltados celestes en toques táctiles (`-webkit-tap-highlight-color: transparent;`).
  - Al seleccionar Haiku 4.5, la cápsula de esfuerzo permanece visible pero atenudada ("Sin esfuerzo") y deshabilitada.
- 📐 **Compositor Ajustado y Limpio**:
  - Sin barra de desplazamiento gris horizontal en el compositor.
  - Botón de adjuntar con icono único `+`.
  - Area de escritura con altura inicial amplia (`min-height: 72px`) y placeholder *"Escribe un mensaje a Claude..."*.
- 💡 **Identificación Local de Modelo y Esfuerzo**:
  - Las preguntas sobre modelo o versión se responden localmente desde el estado de la interfaz sin realizar llamadas ni inyectar prompts ocultos a la API.
- 📥 **Descargas Inteligentes (.html y .txt)**:
  - Detección automática: descarga documentos HTML completos como `.html` e informes/textos como `.txt` limpio.

---

## 🛠️ Estructura del Proyecto

```text
aizen-claude-chat/
├── index.html     # Estructura semántica de la interfaz
├── styles.css     # Estilos estilo Claude, temas y responsive 100dvh
├── app.js         # Lógica del cliente, controlador de streaming, archivos y continuaciones
└── README.md      # Documentación
```

---

## 👤 Créditos

Creado por **Aizen**.
EOF
