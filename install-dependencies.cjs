const { exec } = require('child_process');
const { promisify } = require('util');

const execAsync = promisify(exec);

console.log('📦 Instalando dependências para transcrição de áudio...\n');

async function installDependencies() {
  const dependencies = [
    'node-fetch@2',
    'form-data'
  ];

  for (const dep of dependencies) {
    try {
      console.log(`📥 Instalando ${dep}...`);
      const { stdout, stderr } = await execAsync(`npm install ${dep}`);
      console.log(`✅ ${dep} instalado com sucesso`);
    } catch (error) {
      console.error(`❌ Erro ao instalar ${dep}:`, error.message);
    }
  }

  console.log('\n✅ Instalação concluída!');
  console.log('💡 Agora você pode executar: node transcribe-audio-files.js');
}

installDependencies(); 