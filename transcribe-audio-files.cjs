const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const { promisify } = require('util');

// Promisify exec for async/await
const execAsync = promisify(exec);

// Configurações
const AUDIO_FOLDER = 'C:\\Users\\Flavio Goncalves\\Downloads\\TCR-Verbio';
const TEMP_FOLDER = path.join(__dirname, 'temp_converted');
const SIPPULSE_API_KEY = process.env.SIPPULSE_API_KEY || 'YOUR_API_KEY_HERE';

// Extensões suportadas
const INPUT_EXTENSIONS = ['.mp3', '.wav', '.flac', '.m4a', '.aac', '.ogg'];
const CONVERT_TO_FORMAT = 'wav'; // ou 'flac' se preferir

console.log('🎙️ Utilitário de Transcrição de Áudio - TalkIntel AI');
console.log('Este utilitário converterá e processará arquivos de áudio para transcrição.\n');

class AudioTranscriptionProcessor {
  constructor() {
    this.processedFiles = [];
    this.failedFiles = [];
    this.totalFiles = 0;
    this.convertedFiles = [];
  }

  // Verificar dependências
  async checkDependencies() {
    console.log('🔍 Verificando dependências...');
    
    // Verificar FFmpeg
    try {
      await execAsync('ffmpeg -version');
      console.log('   ✅ FFmpeg encontrado');
    } catch (error) {
      console.error('   ❌ FFmpeg não encontrado!');
      console.log('   📋 Instale o FFmpeg:');
      console.log('      1. Baixe de: https://ffmpeg.org/download.html');
      console.log('      2. Adicione ao PATH do sistema');
      console.log('      3. Ou use: winget install FFmpeg');
      return false;
    }

    // Verificar node-fetch
    try {
      require('node-fetch');
      console.log('   ✅ node-fetch disponível');
    } catch (error) {
      console.error('   ❌ node-fetch não encontrado!');
      console.log('   📋 Instale com: npm install node-fetch@2');
      return false;
    }

    // Verificar form-data
    try {
      require('form-data');
      console.log('   ✅ form-data disponível');
    } catch (error) {
      console.error('   ❌ form-data não encontrado!');
      console.log('   📋 Instale com: npm install form-data');
      return false;
    }

    return true;
  }

  // Verificar API key
  checkApiKey() {
    if (!SIPPULSE_API_KEY || SIPPULSE_API_KEY === 'YOUR_API_KEY_HERE') {
      console.error('❌ ERRO: API Key do TalkIntel não configurada!');
      console.log('📋 Configure a variável de ambiente:');
      console.log('   Windows: set SIPPULSE_API_KEY=sua_api_key_aqui');
      console.log('   PowerShell: $env:SIPPULSE_API_KEY="sua_api_key_aqui"');
      return false;
    }
    console.log('✅ API Key configurada');
    return true;
  }

  // Verificar e criar pastas
  setupFolders() {
    if (!fs.existsSync(AUDIO_FOLDER)) {
      console.error(`❌ Pasta de áudio não encontrada: ${AUDIO_FOLDER}`);
      return false;
    }

    // Criar pasta temporária se não existir
    if (!fs.existsSync(TEMP_FOLDER)) {
      fs.mkdirSync(TEMP_FOLDER, { recursive: true });
      console.log(`📁 Pasta temporária criada: ${TEMP_FOLDER}`);
    }

    return true;
  }

  // Obter arquivos de áudio
  getAudioFiles() {
    const files = fs.readdirSync(AUDIO_FOLDER);
    const audioFiles = files.filter(file => {
      const ext = path.extname(file).toLowerCase();
      return INPUT_EXTENSIONS.includes(ext);
    });

    console.log(`📁 Pasta: ${AUDIO_FOLDER}`);
    console.log(`🎵 Encontrados ${audioFiles.length} arquivos de áudio:`);
    
    audioFiles.forEach((file, index) => {
      const filePath = path.join(AUDIO_FOLDER, file);
      const stats = fs.statSync(filePath);
      const sizeMB = (stats.size / (1024 * 1024)).toFixed(2);
      console.log(`   ${index + 1}. ${file} (${sizeMB} MB)`);
    });

    return audioFiles;
  }

  // Converter arquivo para formato compatível
  async convertAudio(inputPath, outputPath) {
    const fileName = path.basename(inputPath);
    console.log(`   🔄 Convertendo ${fileName} para ${CONVERT_TO_FORMAT.toUpperCase()}...`);

    try {
      // Comando FFmpeg para conversão
      const ffmpegCmd = `ffmpeg -i "${inputPath}" -acodec pcm_s16le -ar 16000 -ac 1 "${outputPath}" -y`;
      
      const { stdout, stderr } = await execAsync(ffmpegCmd);
      
      if (fs.existsSync(outputPath)) {
        const stats = fs.statSync(outputPath);
        const sizeMB = (stats.size / (1024 * 1024)).toFixed(2);
        console.log(`   ✅ Convertido: ${path.basename(outputPath)} (${sizeMB} MB)`);
        return true;
      } else {
        throw new Error('Arquivo convertido não foi criado');
      }
    } catch (error) {
      console.error(`   ❌ Erro na conversão: ${error.message}`);
      return false;
    }
  }

  // Enviar arquivo para transcrição
  async transcribeFile(filePath) {
    const fileName = path.basename(filePath);
    console.log(`   📡 Enviando ${fileName} para TalkIntel API...`);

    try {
      const fetch = require('node-fetch');
      const FormData = require('form-data');

      // Preparar URL
      const url = new URL('https://api.sippulse.ai/asr/transcribe');
      const params = new URLSearchParams({
        model: 'pulse-precision',
        response_format: 'diarization',
        insights: JSON.stringify({
          summarization: true,
          topic_detection: { topics: [] },
          sentiment_analysis: {
            sentiments: [
              "joy", "trust", "fear", "surprise", "sadness", "disgust", "anger", 
              "anticipation", "neutral", "frustration", "satisfaction", "excitement", 
              "disappointment", "curiosity", "love", "hate", "boredom", "confusion", 
              "embarrassment", "guilt"
            ]
          },
          custom: [
            {
              type: "boolean",
              title: "resolution",
              description: "O problema foi resolvido?"
            },
            {
              type: "string",
              title: "agent_name",
              description: "Qual o nome do agente? se não achar coloque indefinido"
            },
            {
              type: "string",
              title: "customer_name",
              description: "Qual o nome do cliente? se não achar coloque indefinido."
            },
            {
              type: "number",
              title: "saudacao",
              description: "O atendente fez uma saudação profissional ao cliente? Pontos 2.5"
            },
            {
              type: "number",
              title: "identificacao",
              description: "O atendente se identificou? Pontos 2.5"
            },
            {
              type: "number",
              title: "confirmacao",
              description: "O atendente confirmou os dados do cliente? Pontos 10"
            }
          ]
        })
      });
      url.search = params;

      // Criar FormData
      const formData = new FormData();
      const fileStream = fs.createReadStream(filePath);
      formData.append('file', fileStream, {
        filename: fileName,
        contentType: 'audio/wav'
      });

      // Fazer requisição
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'accept': 'application/json',
          'api-key': SIPPULSE_API_KEY,
          ...formData.getHeaders()
        },
        body: formData
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      const transcriptionData = await response.json();
      console.log(`   ✅ Transcrição recebida para ${fileName}`);
      console.log(`   📤 Dados serão salvos automaticamente via webhook do TalkIntel`);
      
        return true;

    } catch (error) {
      console.error(`   ❌ Erro na transcrição: ${error.message}`);
      return false;
    }
  }

  // Processar um arquivo
  async processFile(fileName) {
    const originalPath = path.join(AUDIO_FOLDER, fileName);
    const ext = path.extname(fileName).toLowerCase();
    const baseName = path.basename(fileName, ext);
    const convertedPath = path.join(TEMP_FOLDER, `${baseName}.${CONVERT_TO_FORMAT}`);

    console.log(`\n🎙️ Processando: ${fileName}`);

    try {
      let fileToTranscribe = originalPath;

      // Converter se necessário (MP3 ou outros formatos problemáticos)
      if (ext === '.mp3' || ext === '.m4a' || ext === '.aac') {
        const converted = await this.convertAudio(originalPath, convertedPath);
        if (!converted) {
          throw new Error('Falha na conversão de áudio');
        }
        fileToTranscribe = convertedPath;
        this.convertedFiles.push(convertedPath);
      }

      // Transcrever
      const success = await this.transcribeFile(fileToTranscribe);
      
      if (success) {
        this.processedFiles.push(fileName);
        console.log(`   🎉 ${fileName} processado com sucesso!`);
      } else {
        throw new Error('Falha na transcrição');
      }

    } catch (error) {
      console.error(`   💥 Erro ao processar ${fileName}: ${error.message}`);
      this.failedFiles.push({ file: fileName, error: error.message });
    }
  }

  // Limpar arquivos temporários
  cleanup() {
    console.log('\n🧹 Limpando arquivos temporários...');
    
    this.convertedFiles.forEach(filePath => {
      try {
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
          console.log(`   🗑️ Removido: ${path.basename(filePath)}`);
        }
      } catch (error) {
        console.error(`   ⚠️ Erro ao remover ${filePath}: ${error.message}`);
      }
    });

    // Remover pasta temporária se estiver vazia
    try {
      const files = fs.readdirSync(TEMP_FOLDER);
      if (files.length === 0) {
        fs.rmdirSync(TEMP_FOLDER);
        console.log(`   📁 Pasta temporária removida`);
      }
    } catch (error) {
      // Ignorar erro se pasta não existir
    }
  }

  // Processar todos os arquivos
  async processAllFiles(startFromIndex = 0) {
    console.log('🚀 Iniciando processamento...\n');

    // Verificações iniciais
    if (!(await this.checkDependencies())) return;
    if (!this.checkApiKey()) return;
    if (!this.setupFolders()) return;

    const audioFiles = this.getAudioFiles();
    if (audioFiles.length === 0) {
      console.log('❌ Nenhum arquivo de áudio encontrado');
      return;
    }

    // Verificar se o índice de início é válido
    if (startFromIndex >= audioFiles.length) {
      console.log(`❌ Índice de início (${startFromIndex}) é maior que o número de arquivos (${audioFiles.length})`);
      return;
    }

    // Mostrar arquivos que serão pulados
    if (startFromIndex > 0) {
      console.log(`\n⏭️ Pulando os primeiros ${startFromIndex} arquivos:`);
      for (let i = 0; i < startFromIndex; i++) {
        console.log(`   ${i + 1}. ${audioFiles[i]} (PULADO)`);
      }
    }

    // Arquivos que serão processados
    const filesToProcess = audioFiles.slice(startFromIndex);
    this.totalFiles = filesToProcess.length;
    console.log(`\n🎯 Processando ${this.totalFiles} arquivos (a partir do arquivo ${startFromIndex + 1})...\n`);

    // Processar arquivos sequencialmente
    for (let i = 0; i < filesToProcess.length; i++) {
      const fileName = filesToProcess[i];
      const actualIndex = startFromIndex + i + 1;
      console.log(`📊 Progresso: ${i + 1}/${this.totalFiles} (Arquivo ${actualIndex} da lista completa)`);
      
      await this.processFile(fileName);
      
      // Delay entre arquivos
      if (i < filesToProcess.length - 1) {
        console.log('   ⏳ Aguardando 3 segundos...');
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
    }

    this.cleanup();
    this.showSummary();
  }

  // Mostrar resumo
  showSummary() {
    console.log('\n' + '='.repeat(60));
    console.log('📋 RESUMO DO PROCESSAMENTO');
    console.log('='.repeat(60));
    console.log(`📁 Pasta processada: ${AUDIO_FOLDER}`);
    console.log(`📊 Total de arquivos: ${this.totalFiles}`);
    console.log(`✅ Processados com sucesso: ${this.processedFiles.length}`);
    console.log(`❌ Falharam: ${this.failedFiles.length}`);

    if (this.processedFiles.length > 0) {
      console.log('\n✅ Arquivos processados com sucesso:');
      this.processedFiles.forEach((file, index) => {
        console.log(`   ${index + 1}. ${file}`);
      });
    }

    if (this.failedFiles.length > 0) {
      console.log('\n❌ Arquivos que falharam:');
      this.failedFiles.forEach((item, index) => {
        console.log(`   ${index + 1}. ${item.file}`);
        console.log(`       Erro: ${item.error}`);
      });
    }

    console.log('\n🎉 Processamento concluído!');
    console.log('💡 Verifique o dashboard para ver as novas análises de chamadas.');
    
    if (this.processedFiles.length > 0) {
      console.log('🌐 Acesse: http://localhost:3000 (se o servidor estiver rodando)');
    }
  }
}

// Executar se chamado diretamente
if (require.main === module) {
  const processor = new AudioTranscriptionProcessor();
  
  // Verificar argumentos da linha de comando
  const args = process.argv.slice(2);
  let startFromIndex = 0;
  
  // Verificar se foi passado um número como argumento
  if (args.length > 0) {
    const argIndex = parseInt(args[0]);
    if (!isNaN(argIndex) && argIndex > 0) {
      startFromIndex = argIndex - 1; // Converter de 1-based para 0-based
      console.log(`🎯 Configurado para começar a partir do arquivo ${argIndex}`);
    } else if (args[0] === '--help' || args[0] === '-h') {
      console.log('🎙️ Utilitário de Transcrição de Áudio - TalkIntel AI');
      console.log('\n📋 Uso:');
      console.log('   node transcribe-audio-files.cjs [número_do_arquivo]');
      console.log('\n📖 Exemplos:');
      console.log('   node transcribe-audio-files.cjs        # Processar todos os arquivos');
      console.log('   node transcribe-audio-files.cjs 3      # Começar a partir do 3º arquivo');
      console.log('   node transcribe-audio-files.cjs 1      # Começar do primeiro arquivo (padrão)');
      console.log('\n💡 Dica: Use um número para pular arquivos já processados');
      process.exit(0);
    } else {
      console.log('⚠️ Argumento inválido. Use um número ou --help para ajuda');
      process.exit(1);
    }
  }
  
  processor.processAllFiles(startFromIndex).catch(console.error);
}

module.exports = AudioTranscriptionProcessor; 