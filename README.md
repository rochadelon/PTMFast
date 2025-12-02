# 🚀 Mistral OCR Chrome Extension

![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)
![Chrome](https://img.shields.io/badge/Chrome-Extension-4285F4?style=flat&logo=google-chrome&logoColor=white)
![Mistral AI](https://img.shields.io/badge/Mistral%20AI-Powered-F5A623?style=flat&logo=openai&logoColor=white)
![License](https://img.shields.io/badge/license-MIT-green.svg)

Uma extensão poderosa para Chrome que utiliza a API da Mistral AI para converter PDFs em Markdown de alta qualidade, preservando formatação, tabelas e imagens.

## ✨ Funcionalidades

- **📄 Conversão Precisa:** Transforma PDFs em Markdown limpo e estruturado.
- **🖼️ Suporte a Imagens:** Extrai e posiciona imagens automaticamente no texto.
- **🧹 Limpeza Inteligente:** Remove artefatos e repetições comuns de OCR.
- **🔗 Detecção Automática:** Identifica PDFs abertos na aba atual ou em links da página.
- **⚡ Rápido e Leve:** Processamento direto via API, sem peso no navegador.

## 🛠️ Instalação

1. Clone este repositório ou baixe os arquivos.
2. Abra o Chrome e vá para `chrome://extensions/`.
3. Ative o **Modo do desenvolvedor** (canto superior direito).
4. Clique em **Carregar sem compactação**.
5. Selecione a pasta onde os arquivos estão salvos.

## 🔑 Configuração

1. Obtenha sua chave de API na [Mistral AI Platform](https://console.mistral.ai/).
2. Clique no ícone da extensão no navegador.
3. Cole sua chave no campo **API Key**.
4. Pronto! Agora é só usar.

## 🖥️ Como Usar

1. Abra um PDF no navegador (ou uma página com links para PDFs).
2. Abra a extensão.
3. Selecione o PDF desejado na lista.
4. Clique em **Processar PDF**.
5. Aguarde a extração e copie ou baixe o Markdown resultante!

## 📦 Estrutura do Projeto

- `manifest.json`: Configuração da extensão (Manifest V3).
- `popup.html`: Interface do usuário.
- `popup.js`: Lógica principal (Detecção, API, Limpeza).
- `styles.css`: Estilização da interface.

## 🤝 Contribuição

Sinta-se à vontade para abrir issues ou enviar pull requests para melhorias!

---
