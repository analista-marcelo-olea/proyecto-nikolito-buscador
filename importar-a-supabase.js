const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

// Configuración de Supabase
const supabaseUrl = 'https://tqmdebzydtgjafmdihqd.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRxbWRlYnp5ZHRnamFmbWRpaHFkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDgxODM0OTIsImV4cCI6MjA2Mzc1OTQ5Mn0.c8FhzX4gQVEiq5w2Yv-JhpHmOH4_cdtKwsvotzdU198';

const supabase = createClient(supabaseUrl, supabaseKey);

// Archivo CSV a importar
const archivoCSV = '2503 - Reporte FNL - LT.csv';

function parsearFecha(fechaStr) {
    if (!fechaStr || fechaStr === '-' || fechaStr === '') return null;

    // Intentar diferentes formatos de fecha
    const formatos = [
        /^(\d{1,2})\/(\d{1,2})\/(\d{2})$/, // MM/DD/YY
        /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/, // MM/DD/YYYY
        /^(\d{4})-(\d{2})-(\d{2})$/, // YYYY-MM-DD
    ];

    for (let formato of formatos) {
        const match = fechaStr.match(formato);
        if (match) {
            if (formato.source.includes('\\d{2}$')) {
                // Formato MM/DD/YY - convertir año de 2 dígitos
                let [, mes, dia, anio] = match;
                anio = parseInt(anio);
                anio = anio > 50 ? 1900 + anio : 2000 + anio;
                return `${anio}-${mes.padStart(2, '0')}-${dia.padStart(2, '0')}`;
            } else if (formato.source.includes('\\d{4}')) {
                // Formato MM/DD/YYYY
                const [, mes, dia, anio] = match;
                return `${anio}-${mes.padStart(2, '0')}-${dia.padStart(2, '0')}`;
            } else {
                // Formato YYYY-MM-DD
                return fechaStr;
            }
        }
    }

    return null;
}

function convertirValor(valor, tipo) {
    if (valor === '' || valor === '-' || valor === null || valor === undefined) {
        return null;
    }

    switch (tipo) {
        case 'integer':
            const num = parseInt(valor);
            return isNaN(num) ? null : num;
        case 'date':
            return parsearFecha(valor);
        default:
            return valor;
    }
}

async function importarCSV() {
    try {
        console.log('📖 Leyendo archivo CSV:', archivoCSV);

        if (!fs.existsSync(archivoCSV)) {
            console.error('❌ Error: No se encontró el archivo', archivoCSV);
            console.log('💡 Primero ejecuta: node convertir-excel-csv.js');
            return;
        }

        const csvContent = fs.readFileSync(archivoCSV, 'utf8');
        const lineas = csvContent.split('\n').filter(linea => linea.trim());

        console.log('📊 Total de líneas encontradas:', lineas.length);

        if (lineas.length < 2) {
            console.error('❌ Error: El archivo CSV está vacío o solo tiene headers');
            return;
        }

        // Obtener headers (primera línea)
        const headers = lineas[0].split(',').map(h => h.trim().toLowerCase());
        console.log('📋 Headers encontrados:', headers.slice(0, 5), '...');

        // Procesar datos (resto de líneas)
        const datos = [];

        for (let i = 1; i < lineas.length; i++) {
            const valores = lineas[i].split(',');

            if (valores.length !== headers.length) {
                console.warn(`⚠️ Línea ${i + 1} tiene ${valores.length} valores pero se esperaban ${headers.length}`);
                continue;
            }

            const fila = {};

            // Mapear cada valor según su tipo
            const tiposColumnas = {
                consecutive: 'integer',
                nis: 'integer',
                fecha_retiro: 'date',
                fecha_cambio_est: 'date',
                fecha_crea_nis: 'date',
                contrato: 'integer',
                anio: 'integer',
                mes: 'integer',
                ciclo_consumo: 'integer',
                lectura: 'integer',
                cant_insp_cnr: 'integer',
                cant_hallazgos: 'integer',
                cant_carga: 'integer',
                cons_kwh: 'integer',
                constante: 'integer',
                cant_dig: 'integer',
                fact_kwh: 'integer',
                fecha_ult_lect: 'date',
                ult_lect: 'integer',
                cant_est_fnl: 'integer',
                prom_cons_12lect: 'integer',
                fnl: 'integer',
                fecha_inst_med: 'date',
                prop_med: 'integer',
                fecha_lectura: 'date',
                cant_cerrado: 'integer',
                cant_leido: 'integer',
                cant_estimado: 'integer'
            };

            headers.forEach((header, index) => {
                const valor = valores[index]?.trim().replace(/^"|"$/g, ''); // Remover comillas
                const tipo = tiposColumnas[header] || 'string';
                fila[header] = convertirValor(valor, tipo);
            });

            datos.push(fila);
        }

        console.log('✅ Datos procesados:', datos.length, 'filas');
        console.log('🔍 Muestra de la primera fila:', JSON.stringify(datos[0], null, 2));

        // Importar a Supabase en lotes
        const tamanoLote = 100;
        let totalImportados = 0;

        for (let i = 0; i < datos.length; i += tamanoLote) {
            const lote = datos.slice(i, i + tamanoLote);

            console.log(`📤 Importando lote ${Math.floor(i / tamanoLote) + 1}/${Math.ceil(datos.length / tamanoLote)}...`);

            const { data, error } = await supabase
                .from('reporte_fnl')
                .insert(lote);

            if (error) {
                console.error('❌ Error al importar lote:', error);
                break;
            }

            totalImportados += lote.length;
            console.log(`✅ Lote importado. Total: ${totalImportados}/${datos.length}`);
        }

        console.log('🎉 Importación completada!');
        console.log('📊 Total de registros importados:', totalImportados);

    } catch (error) {
        console.error('❌ Error durante la importación:', error.message);
        console.log('\n💡 Posibles soluciones:');
        console.log('1. Verificar la clave de Supabase');
        console.log('2. Verificar que la tabla existe en Supabase');
        console.log('3. Instalar dependencias: npm install @supabase/supabase-js');
    }
}

// Ejecutar la importación
console.log('🚀 Iniciando importación a Supabase...\n');
importarCSV();
