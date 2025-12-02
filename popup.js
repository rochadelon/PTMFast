// ======================
// Estado da Extensão
// ======================
const state = {
    apiKey: localStorage.getItem('mistralApiKey') || '',
    pdfs: [],
    selectedPdf: null,
    currentMarkdown: ''
};

const elements = {
    apiKey: document.getElementById('apiKey'),
    pdfList: document.getElementById('pdfList'),
    pdfCount: document.getElementById('pdfCount'),
    noPdfMessage: document.getElementById('noPdfMessage'),
    status: document.getElementById('status'),
    outputSection: document.getElementById('outputSection'),
    markdownOutput: document.getElementById('markdownOutput'),
    btnRefresh: document.getElementById('btnRefresh'),
    btnProcess: document.getElementById('btnProcess'),
    btnCopy: document.getElementById('btnCopy'),
    btnDownload: document.getElementById('btnDownload')
};

// ======================
// Funções Utilitárias
// ======================
const showStatus = (message, type = 'loading') => {
    elements.status.textContent = type === 'loading' ? '⏳ ' + message :
        type === 'success' ? '✅ ' + message :
            '❌ ' + message;
    elements.status.className = `status show ${type}`;
};

const hideStatus = () => {
    elements.status.className = 'status';
};

const saveApiKey = () => {
    state.apiKey = elements.apiKey.value.trim();
    localStorage.setItem('mistralApiKey', state.apiKey);
};

// ======================
// Detecção de PDFs
// ======================
const detectPdfs = async () => {
    showStatus('Detectando PDFs na página...');

    try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

        if (!tab) {
            throw new Error("Nenhuma aba ativa encontrada.");
        }

        const detectedPdfs = [];

        // 1. Check if current tab is a PDF
        if (tab.url && tab.url.toLowerCase().endsWith('.pdf')) {
            detectedPdfs.push({
                name: tab.title || tab.url.split('/').pop(),
                url: tab.url
            });
        }

        // 2. Try to find PDFs in the page content
        try {
            const results = await chrome.scripting.executeScript({
                target: { tabId: tab.id },
                func: () => {
                    const pdfLinks = [];
                    document.querySelectorAll('a[href*=".pdf"]').forEach(link => {
                        pdfLinks.push({
                            name: link.textContent?.trim() || link.href.split('/').pop(),
                            url: link.href
                        });
                    });
                    document.querySelectorAll('embed[src*=".pdf"], iframe[src*=".pdf"]').forEach(elem => {
                        pdfLinks.push({
                            name: elem.src.split('/').pop(),
                            url: elem.src
                        });
                    });
                    return pdfLinks;
                }
            });

            if (results && results[0] && results[0].result) {
                detectedPdfs.push(...results[0].result);
            }
        } catch (scriptError) {
            console.log('Script execution failed (likely restricted page):', scriptError);
            if (detectedPdfs.length === 0) {
                console.warn('No main PDF found and script failed.');
            }
        }

        // Remove duplicates
        const uniquePdfs = Array.from(new Map(
            detectedPdfs.map(p => [p.url, p])
        ).values());

        state.pdfs = uniquePdfs;
        renderPdfList();
        hideStatus();
    } catch (err) {
        showStatus('Erro ao detectar PDFs: ' + err.message, 'error');
        console.error(err);
    }
};

// ======================
// Renderização da UI
// ======================
const renderPdfList = () => {
    if (state.pdfs.length === 0) {
        elements.pdfCount.textContent = 'Nenhum PDF encontrado';
        elements.pdfList.style.display = 'none';
        elements.noPdfMessage.style.display = 'block';
        elements.btnProcess.disabled = true;
        return;
    }

    elements.pdfCount.textContent = `${state.pdfs.length} PDF(s) encontrado(s)`;
    elements.pdfList.style.display = 'block';
    elements.noPdfMessage.style.display = 'none';
    elements.pdfList.innerHTML = state.pdfs.map((pdf, idx) => `
        <label class="pdf-item">
            <input 
                type="radio" 
                name="selectedPdf" 
                value="${idx}"
                ${state.selectedPdf === idx ? 'checked' : ''}
            >
            <span class="pdf-name">${escapeHtml(pdf.name)}</span>
        </label>
    `).join('');

    document.querySelectorAll('input[name="selectedPdf"]').forEach(input => {
        input.addEventListener('change', (e) => {
            state.selectedPdf = parseInt(e.target.value);
            elements.btnProcess.disabled = !state.apiKey || state.selectedPdf === null;
        });
    });

    if (state.selectedPdf === null && state.pdfs.length > 0) {
        state.selectedPdf = 0;
        elements.btnProcess.disabled = !state.apiKey;
    }
};

// ======================
// Processamento OCR
// ======================
const processPdf = async () => {
    if (!state.apiKey) {
        showStatus('Configure sua chave API antes', 'error');
        return;
    }

    if (state.selectedPdf === null) {
        showStatus('Selecione um PDF', 'error');
        return;
    }

    const pdfUrl = state.pdfs[state.selectedPdf].url;
    showStatus('Baixando PDF...');
    elements.btnProcess.disabled = true;

    try {
        // 1. Fetch PDF content to avoid accessibility issues
        let documentUrlToSend = pdfUrl;
        try {
            const pdfResponse = await fetch(pdfUrl);
            const blob = await pdfResponse.blob();
            const base64Data = await new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onloadend = () => resolve(reader.result);
                reader.onerror = reject;
                reader.readAsDataURL(blob);
            });
            documentUrlToSend = base64Data;
            showStatus('Processando PDF com Mistral OCR...');
        } catch (fetchError) {
            console.warn('Falha ao baixar PDF localmente, tentando URL direta:', fetchError);
            showStatus('Processando URL direta...');
        }

        const response = await fetch('https://api.mistral.ai/v1/ocr', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${state.apiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: 'mistral-ocr-latest',
                document: {
                    type: 'document_url',
                    document_url: documentUrlToSend
                },
                include_image_base64: true // Enable images
            })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || `API Error: ${response.status}`);
        }

        const data = await response.json();

        let rawMarkdown = '';
        if (data.pages && Array.isArray(data.pages)) {
            rawMarkdown = data.pages.map(page => page.markdown).join('\n\n---\n\n');
        } else if (data.content) {
            rawMarkdown = data.content;
        } else {
            console.error('Unexpected API Response:', data);
            rawMarkdown = 'Erro: Formato de resposta da API desconhecido.';
        }

        if (!rawMarkdown) {
            rawMarkdown = 'Nenhum conteúdo extraído (resposta vazia).';
        }

        // Post-processing: Clean and Format
        state.currentMarkdown = cleanMarkdown(rawMarkdown);

        // Render preview (handling HTML images)
        elements.markdownOutput.innerHTML = renderMarkdownPreview(state.currentMarkdown);
        elements.outputSection.classList.add('show');

        showStatus(`✨ Sucesso! ${Math.round(state.currentMarkdown.length / 1000)}KB extraído`, 'success');

        setTimeout(() => hideStatus(), 3000);
    } catch (err) {
        showStatus('Erro: ' + err.message, 'error');
        console.error(err);
    } finally {
        elements.btnProcess.disabled = false;
    }
};

// ======================
// Limpeza e Formatação
// ======================
const cleanMarkdown = (text) => {
    let cleaned = text;

    // 1. Remove repetitive hallucinations
    const repetitionRegex = /(.{5,})(\s+\1){4,}/g;
    cleaned = cleaned.replace(repetitionRegex, (match, group1) => {
        return `\n*[Texto repetitivo removido: ${group1.substring(0, 20)}...]*\n`;
    });

    // 2. Specific fix for LaTeX hallucination
    cleaned = cleaned.replace(/(\$\$ \\hat\{\\text\{O\}\} \$\$[\s\n]*){3,}/g, '\n*[Artefato LaTeX removido]*\n');

    // 3. Format Images: Center and add spacing
    cleaned = cleaned.replace(/!\[(.*?)\]\((.*?)\)/g, (match, alt, src) => {
        return `
<br>
<div align="center" style="margin: 20px 0; padding: 10px; background: #f8f9fa; border-radius: 8px;">
    <img src="${src}" alt="${alt}" style="max-width: 100%; height: auto; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
    ${alt ? `<p style="font-size: 12px; color: #666; margin-top: 5px;">${alt}</p>` : ''}
</div>
<br>
`;
    });

    return cleaned;
};

const renderMarkdownPreview = (text) => {
    // Basic escape for display, but keep our HTML tags
    return text.replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/&lt;br&gt;/g, '<br>')
        .replace(/&lt;div/g, '<div').replace(/&lt;\/div&gt;/g, '</div>')
        .replace(/&lt;img/g, '<img').replace(/&lt;p/g, '<p').replace(/&lt;\/p&gt;/g, '</p>');
};

// ======================
// Ações de Download/Cópia
// ======================
const copyToClipboard = () => {
    navigator.clipboard.writeText(state.currentMarkdown).then(() => {
        showStatus('✅ Copiado para área de transferência', 'success');
        setTimeout(hideStatus, 2000);
    }).catch(() => {
        showStatus('Erro ao copiar', 'error');
    });
};

const downloadMarkdown = () => {
    const pdfName = state.pdfs[state.selectedPdf].name.replace('.pdf', '');
    const blob = new Blob([state.currentMarkdown], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${pdfName}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
};

// ======================
// Utilitários
// ======================
const escapeHtml = (text) => {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
};

// ======================
// Event Listeners
// ======================
elements.apiKey.value = state.apiKey;
elements.apiKey.addEventListener('change', saveApiKey);

elements.btnRefresh.addEventListener('click', detectPdfs);
elements.btnProcess.addEventListener('click', processPdf);
elements.btnCopy.addEventListener('click', copyToClipboard);
elements.btnDownload.addEventListener('click', downloadMarkdown);

// Inicialização
window.addEventListener('load', detectPdfs);
