# 🌟 Aizen — Claude Chat Workspace

[![GitHub Pages Deployment](https://img.shields.io/badge/GitHub%20Pages-Live-success?style=for-the-badge&logo=github)](https://oruzai.github.io/aizen-claude-chat/)

**Aizen** es una elegante interfaz de chat web estática inspirada directamente en la experiencia de usuario de Claude AI. Diseñada de forma 100% cliente sin dependencias de React, Vite, npm o backend dedicado.

---

## 🚀 Demo En Vivo

Accede a la aplicación publicada en GitHub Pages:  
👉 **[https://oruzai.github.io/aizen-claude-chat/](https://oruzai.github.io/aizen-claude-chat/)**

---

## ✨ Características Principales

- 🎨 **Diseño Inspirado en Claude**: Paleta cálida tono crema (`#FBF9F5`), tipografía refinada (Lora + Plus Jakarta Sans + JetBrains Mono) y disposición limpia centrada.
- ⚡ **Streaming de Respuestas en Tiempo Real**: Parser SSE robusto compatible con el endpoint de Claude.
- 🔌 **Conexión Directa a Nghimmo API**: Se conecta exclusivamente a `https://api.nghimmo.com/v1/messages`.
- 🎛️ **Selector de Modelos Claude**:
  - `Claude 3.7 Sonnet` (`claude-3-7-sonnet-20250219`)
  - `Claude 3.5 Sonnet` (`claude-3-5-sonnet-20241022`)
  - `Claude 3.5 Haiku` (`claude-3-5-haiku-20241022`)
  - `Claude 3 Opus` (`claude-3-opus-20240229`)
  - Opción para modelo personalizado.
- 📂 **Soporte Multiformato de Archivos**:
  - **Imágenes** (PNG, JPG, WEBP, GIF) codificadas en Base64.
  - **Documentos PDF** para procesamiento directo de documentos.
  - **Archivos de Texto y Código** (.txt, .md, .js, .py, .json, .csv, etc.).
- 💻 **Bloques de Código y Respuestas Interactivas**:
  - Botón para **Copiar** código al portapapeles.
  - Botón para **Descargar** fragmentos de código con su extensión adecuada.
  - Exportación completa de conversaciones en formato Markdown (`.md`).
- 🔒 **Privacidad y Seguridad Garantizada**:
  - La API Key se almacena únicamente en tu navegador (`localStorage`).
  - **Nunca se sube a GitHub** ni a servidores intermediarios.
- 📱 **Diseño 100% Responsivo**: Adaptación completa para celulares, tablets y computadoras de escritorio.

---

## 🛠️ Estructura del Proyecto

```text
aizen-claude-chat/
├── index.html     # Estructura semántica de la interfaz web
├── styles.css     # Paleta de colores cálida crema, tipografía y responsive design
├── app.js         # Cliente de API Claude, streaming SSE, almacenamiento local e historial
└── README.md      # Documentación del proyecto
```

---

## 👤 Créditos

Creado por **Aizen**.
EOF
