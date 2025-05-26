const XLSX = require('xlsx');
const fs = require('fs');
const iconv = require('iconv-lite');

// Configuración
const archivoExcel = '2503 - Reporte FNL - LT.xlsx';
const archivoCSV = '2503 - Reporte FNL - LT.csv';

// Mapa de correcciones de caracteres específicos
const correccionesEspecificas = {
    'ConexiÃ³n': 'Conexión',
    'ALMACÃ‰N': 'ALMACÉN',
    'LeÃ­do': 'Leído',
    'EstimaciÃ³n': 'Estimación',
    'InspecciÃ³n': 'Inspección',
    'VerificaciÃ³n': 'Verificación',
    'MediciÃ³n': 'Medición',
    'InstalaciÃ³n': 'Instalación',
    'CalibraciÃ³n': 'Calibración',
    'RevisiÃ³n': 'Revisión',
    'SoluciÃ³n': 'Solución',
    'AtenciÃ³n': 'Atención',
    'InformaciÃ³n': 'Información',
    'OperaciÃ³n': 'Operación',
    'AdministraciÃ³n': 'Administración'
};

function limpiarTextoCompleto(texto) {
    if (typeof texto !== 'string') return texto;
    
    let textoLimpio = texto;
    
    // Aplicar correcciones específicas primero
    Object.keys(correccionesEspecificas).forEach(clave => {
        const regex = new RegExp(clave, 'g');
        textoLimpio = textoLimpio.replace(regex, correccionesEspecificas[clave]);
    });
    
    // Luego aplicar correcciones generales
    textoLimpio = textoLimpio
        .replace(/Ã³/g, 'ó')
        .replace(/Ã¡/g, 'á')
        .replace(/Ã©/g, 'é')
        .replace(/Ã­/g, 'í')
        .replace(/Ãº/g, 'ú')
        .replace(/Ã±/g, 'ñ')
        .replace(/Ã‰/g, 'É')
        .replace(/Ã/g, 'Á')
        .replace(/Ã"/g, 'Í')
        .replace(/Ãš/g, 'Ú')
        .replace(/Ã'/g, 'Ñ')
        .replace(/Ã§/g, 'ç')
        .replace(/Ã¼/g, 'ü')
        .replace(/Ã¨/g, 'è')
        .replace(/Ã /g, 'à')
        .replace(/Ã¬/g, 'ì')
        .replace(/Ã²/g, 'ò')
        .replace(/Ã¹/g, 'ù')
        // Corregir patrones de fecha con espacios extra
        .replace(/(\d{4}-\d{2}-\d{2})\s\s+(\d{2}:\d{2}:\d{2})/g, '$1 $2')
        .replace(/(\d{1,2})\/(\d{1,2})\/(\d{2,4})\s\s+(\d{2}:\d{2}:\d{2})/g, '$1/$2/$3 $4')
        // Limpiar espacios extra
        .replace(/\s+/g, ' ')
        .trim();
    
    return textoLimpio;
}

function convertirExcelACSV() {
    try {
        console.log('📖 Leyendo archivo Excel:', archivoExcel);
        
        // Verificar si el archivo existe
        if (!fs.existsSync(archivoExcel)) {
            console.error('❌ Error: No se encontró el archivo', archivoExcel);
            console.log('📁 Archivos disponibles en el directorio:');
            fs.readdirSync('.').forEach(file => {
                if (file.endsWith('.xlsx') || file.endsWith('.xls')) {
                    console.log('   -', file);
                }
            });
            return;
        }

        // Leer el archivo Excel con configuración específica para caracteres
        const workbook = XLSX.readFile(archivoExcel, {
            type: 'buffer',
            codepage: 65001 // UTF-8
        });
        
        // Obtener la primera hoja
        const sheetName = workbook.SheetNames[0];
        console.log('📄 Procesando hoja:', sheetName);
        
        const worksheet = workbook.Sheets[sheetName];
        
        // Convertir a JSON manteniendo el formato original
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { 
            header: 1,
            raw: false,
            defval: '', // Valor por defecto para celdas vacías
            blankrows: false // Omitir filas vacías
        });

        console.log('🔍 Datos encontrados:', jsonData.length, 'filas');
        
        if (jsonData.length === 0) {
            console.error('❌ Error: El archivo Excel está vacío o no se pudo leer');
            return;
        }

        // Procesar los datos
        const datosCorregidos = jsonData.map(fila => {
            return fila.map(celda => limpiarTextoCompleto(celda));
        });

        // Convertir a CSV con codificación UTF-8
        const csvContent = datosCorregidos
            .map(fila => 
                fila.map(celda => {
                    // Manejar valores que contienen comas, comillas o saltos de línea
                    const valor = String(celda || '');
                    if (valor.includes(',') || valor.includes('"') || valor.includes('\n') || valor.includes('\r')) {
                        return `"${valor.replace(/"/g, '""')}"`;
                    }
                    return valor;
                }).join(',')
            )
            .join('\n');

        // Guardar con codificación UTF-8 explícita
        fs.writeFileSync(archivoCSV, '\ufeff' + csvContent, 'utf8'); // \ufeff es el BOM para UTF-8
        
        console.log('✅ Conversión completada exitosamente!');
        console.log('📁 Archivo CSV generado:', archivoCSV);
        console.log('📊 Total de filas procesadas:', datosCorregidos.length);
        
        // Mostrar muestra de los datos corregidos
        console.log('\n🔍 Muestra de los primeros datos corregidos:');
        datosCorregidos.slice(0, 3).forEach((fila, i) => {
            console.log(`Fila ${i + 1}:`, fila.slice(0, 10).join(' | '));
        });

        // Verificar correcciones específicas
        console.log('\n🔧 Verificando correcciones aplicadas:');
        const contenidoCompleto = csvContent;
        Object.keys(correccionesEspecificas).forEach(original => {
            if (contenidoCompleto.includes(original)) {
                console.log(`⚠️  Aún encontrado: ${original}`);
            } else {
                console.log(`✅ Corregido: ${original} → ${correccionesEspecificas[original]}`);
            }
        });

    } catch (error) {
        console.error('❌ Error durante la conversión:', error.message);
        console.log('\n💡 Posibles soluciones:');
        console.log('1. Verificar que el archivo Excel no esté abierto');
        console.log('2. Verificar que el archivo no esté corrupto');
        console.log('3. Instalar dependencias: npm install xlsx iconv-lite');
    }
}

// Ejecutar la conversión
console.log('🚀 Iniciando conversión mejorada de Excel a CSV...\n');
convertirExcelACSV();
