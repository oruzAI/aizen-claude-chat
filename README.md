# 🌟 Aizen — Claude Workspace

[![GitHub Pages Deployment](https://img.shields.io/badge/GitHub%20Pages-Live-success?style=for-the-badge&logo=github)](https://oruzai.github.io/aizen-claude-chat/)

**Aizen** es un cliente web estático de Claude diseñado para ofrecer una experiencia cercana a la interfaz original de Claude en distribución, comportamiento del chat, compositor, mensajes, archivos y respuestas extensas.

---

## 🚀 Demo En Vivo

Accede a la aplicación en GitHub Pages:  
👉 **[https://oruzai.github.io/aizen-claude-chat/](https://oruzai.github.io/aizen-claude-chat/)**

---

## ✨ Características Principalmente Refinadas

- 🛑 **Botón Detener Real y Confiable**:
  - Control mediante `AbortController` y `reader.cancel()` activo que interrumpe la respuesta inmediatamente sin congelar la interfaz ni mostrar errores falsos.
- 📜 **Lectura Estable sin Autoscroll Molesto**:
  - Se desplaza automáticamente una sola vez al enviar. Durante el streaming no fuerza el scroll, permitiendo leer mientras se genera la respuesta.
  - Botón flotante **Ir al final ↓** para volver al último mensaje si se desea.
- 🎛️ **Encabezado Limpio y Compositor Integrado**:
  - Encabezado libre de símbolos decorativos o selectores desordenados.
  - Cápsulas de **Modelos** y **Nivel de Esfuerzo** integradas dentro del compositor inferior junto al botón Adjuntar.
  - Menús emergentes que despliegan hacia arriba de forma elegante.
- 💬 **Burbujas y Estilo de Mensajes Inspirados en Claude**:
  - Mensaje de usuario como única burbuja oscura alineada a la derecha.
  - Respuestas de Claude integradas directamente en el lienzo del chat (sin tarjetas gigantes alrededor de cada respuesta).
  - Indicador discreto `● Pensando… 12.34 s` con medición precisa en centésimas usando `performance.now()`.
- ⚡ **Continuación Automática en Respuestas Largas**:
  - Si la salida se interrumpe por límite de tokens (`max_tokens`), continúa automáticamente sin duplicar tarjetas ni perder frases.
- 📂 **Archivos y Arrastrar y Soltar (Drag & Drop)**:
  - Arrastra archivos desde la computadora directamente al lienzo.
  - Modo directo en Base64 para PDF (<30 MB) con estado "Listo" inmediato.
  - Soporte de Imágenes, PDF, DOCX, XLSX, CSV y Texto.
  - Tarjeta de descarga inmediata cuando el usuario pide crear un archivo (PDF, DOCX, Excel, etc.).
- 🌓 **Tema Claro, Oscuro y de Sistema**:
  - Segmento visual en el panel lateral para conmutar fácilmente de tema.
- 📱 **Diseño 100dvh Responsivo**:
  - Adaptación perfecta para pantallas móviles, tabletas y PC.

---

## 🛠️ Estructura del Proyecto

```text
aizen-claude-chat/
├── index.html     # Estructura semántica de la interfaz
├── styles.css     # Estilos estilo Claude, temas y responsive 100dvh
├── app.js         # Cliente de chat, procesamiento de archivos, streaming y continuaciones
└── README.md      # Documentación
```

---

## 👤 Créditos

Creado por **Aizen**.
EOF
