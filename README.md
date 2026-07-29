# 🌟 Aizen — Claude Workspace

[![GitHub Pages Deployment](https://img.shields.io/badge/GitHub%20Pages-Live-success?style=for-the-badge&logo=github)](https://oruzai.github.io/aizen-claude-chat/)

**Aizen** es una elegante interfaz de chat web estática inspirada en Claude AI. Diseñada de forma 100% cliente sin dependencias de React, Vite, npm o backend dedicado.

---

## 🚀 Demo En Vivo

Accede a la aplicación publicada en GitHub Pages:  
👉 **[https://oruzai.github.io/aizen-claude-chat/](https://oruzai.github.io/aizen-claude-chat/)**

---

## ✨ Características Principales

- 🎨 **Diseño Inspirado en Claude**: Paleta cálida tono crema, modo Claro/Oscuro, tipografía refinada (Lora + Plus Jakarta Sans + JetBrains Mono) y disposición limpia centrada.
- ⏱️ **Indicador de Pensamiento con Tiempo Preciso**: Medición progresiva en tiempo real con centésimas de segundo mediante `performance.now()`.
- 🎛️ **Selector Limpio de Modelos Claude**:
  - `Claude Opus 5 Thinking` (predeterminado)
  - `Claude Opus 5`
  - `Claude Opus 4.8 Thinking`
  - `Claude Opus 4.8`
  - `Claude Sonnet 5`
  - `Claude Haiku 4.5`
- ⚡ **Selector de Nivel de Esfuerzo**: Opciones para Bajo, Medio, Alto (predeterminado), Muy alto y Máximo.
- 📂 **Soporte de Archivos Multiformato**:
  - **Imágenes** (PNG, JPG, JPEG, WEBP, GIF).
  - **Documentos PDF** con extracción mediante PDF.js.
  - **Documentos DOCX** con extracción mediante Mammoth.js.
  - **Hojas Excel (XLSX / XLS)** procesadas con SheetJS.
  - **Texto y Código** (.txt, .md, .csv, .json, .html, .xml).
- 💾 **Exportación y Descargas "Descargar como"**:
  - Exportación directa a **PDF, DOCX, XLSX, CSV, Markdown, TXT y HTML**.
- 💻 **Bloques de Código y Respuestas Interactivas**:
  - Botón para **Copiar** código al portapapeles.
  - Botón para **Descargar** fragmentos de código con su extensión adecuada.
- 🔒 **Privacidad y Seguridad Garantizada**:
  - La clave de API se almacena únicamente en tu navegador (`localStorage`).
  - Nunca se sube a GitHub ni se comparte.
- 📱 **Diseño 100% Responsivo**: Mobile-first, ajuste para `100dvh` y compatibilidad con `safe-area-inset-bottom`.

---

## 🛠️ Estructura del Proyecto

```text
aizen-claude-chat/
├── index.html     # Estructura semántica de la interfaz web
├── styles.css     # Estilos modo Claro/Oscuro, paleta crema y responsive design
├── app.js         # Cliente de chat, procesamiento de archivos, streaming y exportaciones
└── README.md      # Documentación del proyecto
```

---

## 👤 Créditos

Creado por **Aizen**.
EOF
