const express = require('express');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const { createClient } = require('@supabase/supabase-js');

const app = express();
const PORT = process.env.PORT || 3000;

// Configuración de Supabase (usando variables de entorno en producción)
const supabaseUrl = process.env.SUPABASE_URL || 'https://tqmdebzydtgjafmdihqd.supabase.co';
const supabaseKey = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRxbWRlYnp5ZHRnamFmbWRpaHFkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDgxODM0OTIsImV4cCI6MjA2Mzc1OTQ5Mn0.c8FhzX4gQVEiq5w2Yv-JhpHmOH4_cdtKwsvotzdU198';
const supabase = createClient(supabaseUrl, supabaseKey);

// Middleware
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static('public'));
app.use(cookieParser());

// Funciones JWT para Vercel
function generateToken(userId) {
    return jwt.sign({ userId }, process.env.SESSION_SECRET || 'tu-secreto-super-seguro-aqui-cambiar-en-produccion', { expiresIn: '24h' });
}

function verifyToken(token) {
    try {
        return jwt.verify(token, process.env.SESSION_SECRET || 'tu-secreto-super-seguro-aqui-cambiar-en-produccion');
    } catch (error) {
        return null;
    }
}

// Middleware para verificar autenticación (solo JWT para Vercel)
function requireAuth(req, res, next) {
    console.log(`🔐 Verificando autenticación para: ${req.path}`);
    
    // Solo usar JWT token en cookies
    const token = req.cookies['nikolito-token'];
    console.log(`🍪 Token encontrado: ${token ? 'SÍ' : 'NO'}`);
    
    if (token) {
        const decoded = verifyToken(token);
        console.log(`🔓 Token válido: ${decoded ? 'SÍ' : 'NO'}`);
        if (decoded) {
            req.userId = decoded.userId;
            console.log(`✅ Usuario autenticado ID: ${decoded.userId}`);
            return next();
        }
    }

    console.log(`❌ Redirigiendo a login desde: ${req.path}`);
    res.redirect('/login');
}

// Función para verificar intentos de login
async function verificarIntentos(usuario) {
    const { data, error } = await supabase
        .from('intentos_login')
        .select('intentos_fallidos, bloqueado_hasta')
        .eq('usuario', usuario)
        .single();

    if (error) return { bloqueado: false, intentos: 0 };

    // Verificar si está bloqueado
    if (data.bloqueado_hasta && new Date(data.bloqueado_hasta) > new Date()) {
        return { bloqueado: true, intentos: data.intentos_fallidos };
    }

    // Si pasó el tiempo de bloqueo, resetear
    if (data.bloqueado_hasta && new Date(data.bloqueado_hasta) <= new Date()) {
        await supabase
            .from('intentos_login')
            .update({ intentos_fallidos: 0, bloqueado_hasta: null })
            .eq('usuario', usuario);
        return { bloqueado: false, intentos: 0 };
    }

    return { bloqueado: false, intentos: data.intentos_fallidos };
}

// Función para incrementar intentos fallidos
async function incrementarIntentos(usuario) {
    const { data } = await supabase
        .from('intentos_login')
        .select('intentos_fallidos')
        .eq('usuario', usuario)
        .single();

    const nuevosIntentos = (data?.intentos_fallidos || 0) + 1;
    let bloqueadoHasta = null;

    // Si llega a 5 intentos, bloquear por 1 minuto
    if (nuevosIntentos >= 5) {
        bloqueadoHasta = new Date(Date.now() + 1 * 60 * 1000); // 1 minuto
    }

    // Si el registro existe, actualizar
    if (data) {
        await supabase
            .from('intentos_login')
            .update({
                intentos_fallidos: nuevosIntentos,
                bloqueado_hasta: bloqueadoHasta,
                updated_at: new Date()
            })
            .eq('usuario', usuario);
    } else {
        // Si no existe, crear nuevo registro
        await supabase
            .from('intentos_login')
            .insert({
                usuario: usuario,
                intentos_fallidos: nuevosIntentos,
                bloqueado_hasta: bloqueadoHasta
            });
    }

    return nuevosIntentos;
}

// Función para resetear intentos
async function resetearIntentos(usuario) {
    await supabase
        .from('intentos_login')
        .update({ intentos_fallidos: 0, bloqueado_hasta: null, updated_at: new Date() })
        .eq('usuario', usuario);
}

// Rutas
app.get('/', (req, res) => {
    // Verificar JWT token
    const token = req.cookies['nikolito-token'];
    if (token && verifyToken(token)) {
        res.redirect('/dashboard');
    } else {
        res.redirect('/login');
    }
});

app.get('/login', (req, res) => {
    // Verificar JWT token
    const token = req.cookies['nikolito-token'];
    if (token && verifyToken(token)) {
        res.redirect('/dashboard');
        return;
    }

    res.send(`
        <!DOCTYPE html>
        <html lang="es">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Login - Proyecto Nikolito</title>
            <style>
                body { font-family: Arial, sans-serif; background-color: #f5f5f5; margin: 0; padding: 20px; }
                .container { max-width: 400px; margin: 100px auto; background: white; padding: 30px; border-radius: 10px; box-shadow: 0 0 10px rgba(0,0,0,0.1); }
                h2 { text-align: center; color: #333; margin-bottom: 30px; }
                .form-group { margin-bottom: 20px; }
                label { display: block; margin-bottom: 5px; color: #555; }
                input[type="text"], input[type="password"] { width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 5px; box-sizing: border-box; }
                .btn { width: 100%; padding: 12px; background-color: #007bff; color: white; border: none; border-radius: 5px; cursor: pointer; font-size: 16px; }
                .btn:hover { background-color: #0056b3; }
                .btn-clear { background-color: #6c757d; margin-top: 10px; }
                .btn-clear:hover { background-color: #545b62; }
                .error { color: #dc3545; text-align: center; margin-top: 15px; }
                .info { color: #17a2b8; text-align: center; margin-bottom: 20px; font-size: 14px; }
            </style>
        </head>
        <body>
            <div class="container">
                <h2>🔐 Acceso al Sistema</h2>
                <div class="info">
                    <strong>Usuarios de prueba:</strong><br>
                    admin / admin123<br>
                    marcelo / marcelo123<br>
                    test / test123
                </div>
                <form method="POST" action="/login">
                    <div class="form-group">
                        <label for="usuario">Usuario:</label>
                        <input type="text" id="usuario" name="usuario" required>
                    </div>
                    <div class="form-group">
                        <label for="password">Contraseña:</label>
                        <input type="password" id="password" name="password" required>
                    </div>
                    <button type="submit" class="btn">Iniciar Sesión</button>
                    <button type="button" class="btn btn-clear" onclick="limpiarFormulario()">Limpiar</button>
                </form>
                ${req.query.error ? `<div class="error">${req.query.error}</div>` : ''}
            </div>
            <script>
                function limpiarFormulario() {
                    document.getElementById('usuario').value = '';
                    document.getElementById('password').value = '';
                    document.getElementById('usuario').focus();
                }
            </script>
        </body>
        </html>
    `);
});


app.post('/login', async (req, res) => {
    const { usuario, password } = req.body;

    try {
        // Verificar intentos de login
        const { bloqueado } = await verificarIntentos(usuario);

        if (bloqueado) {
            return res.redirect('/login?error=Usuario bloqueado por 1 minuto debido a múltiples intentos fallidos');
        }

        // Buscar usuario en la base de datos
        const { data: userData } = await supabase
            .from('usuarios')
            .select('id, usuario, password_hash, activo')
            .eq('usuario', usuario)
            .single();

        // Verificar credenciales (usuario y contraseña)
        const credencialesValidas = userData && userData.activo && (
            (password === 'admin123' && usuario === 'admin') ||
            (password === 'marcelo123' && usuario === 'marcelo') ||
            (password === 'test123' && usuario === 'test')
        );

        if (!credencialesValidas) {
            const nuevosIntentos = await incrementarIntentos(usuario);
            const intentosRestantes = 5 - nuevosIntentos;

            if (nuevosIntentos >= 5) {
                return res.redirect('/login?error=Usuario bloqueado por 1 minuto debido a múltiples intentos fallidos');
            } else {
                return res.redirect(`/login?error=Usuario o contraseña incorrectos. Intentos restantes: ${intentosRestantes}`);
            }
        }

        // Login exitoso
        await resetearIntentos(usuario);
        console.log(`✅ Login exitoso para usuario: ${usuario}`);

        // Crear JWT token para Vercel (sin sesiones)
        const jwtToken = generateToken(userData.id);
        console.log(`🔑 JWT token generado para usuario ID: ${userData.id}`);

        // Configurar cookie con JWT (optimizado para Vercel)
        res.cookie('nikolito-token', jwtToken, {
            httpOnly: true,
            secure: true, // Siempre true para Vercel (HTTPS)
            maxAge: 24 * 60 * 60 * 1000, // 24 horas
            sameSite: 'lax', // CRÍTICO: Cambiado de 'none' a 'lax' para Vercel
            path: '/' // Asegurar que esté disponible en toda la app
        });
        console.log(`🍪 Cookie JWT configurada para usuario: ${usuario}`);

        // Crear sesión en la base de datos
        const sessionToken = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
        const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 horas

        await supabase
            .from('sesiones')
            .insert({
                usuario_id: userData.id,
                session_token: sessionToken,
                expires_at: expiresAt
            });

        console.log(`🚀 Redirigiendo a dashboard para usuario: ${usuario}`);
        res.redirect('/dashboard');

    } catch (error) {
        console.error('Error en login:', error);
        res.redirect('/login?error=Error interno del servidor');
    }
});


app.get('/dashboard', requireAuth, async (req, res) => {
    // Obtener el nombre de usuario desde JWT
    let usuario = 'Usuario';
    if (req.userId) {
        // Buscar el usuario en la base de datos usando el ID del JWT
        try {
            const { data: userData } = await supabase
                .from('usuarios')
                .select('usuario')
                .eq('id', req.userId)
                .single();
            if (userData) {
                usuario = userData.usuario;
            }
        } catch (error) {
            console.error('Error obteniendo usuario:', error);
        }
    }

    res.send(`
        <!DOCTYPE html>
        <html lang="es">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Dashboard - Proyecto Nikolito</title>
            <style>
                body { font-family: Arial, sans-serif; background-color: #f8f9fa; margin: 0; padding: 20px; }
                .header { background: white; padding: 20px; border-radius: 10px; box-shadow: 0 0 10px rgba(0,0,0,0.1); margin-bottom: 20px; display: flex; justify-content: space-between; align-items: center; }
                .container { max-width: 1200px; margin: 0 auto; }
                .welcome { color: #333; }
                .logout-btn { background-color: #dc3545; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; }
                .logout-btn:hover { background-color: #c82333; }
                .stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 20px; margin-bottom: 30px; }
                .stat-card { background: white; padding: 20px; border-radius: 10px; box-shadow: 0 0 10px rgba(0,0,0,0.1); text-align: center; }
                .stat-number { font-size: 2em; font-weight: bold; color: #007bff; }
                .search-section { background: white; padding: 30px; border-radius: 10px; box-shadow: 0 0 10px rgba(0,0,0,0.1); }

                /* Estilos para móviles */
                @media (max-width: 768px) {
                    .container { padding: 10px; }
                    .header { flex-direction: column; gap: 10px; text-align: center; }
                    .search-section { padding: 15px; }
                    .stats { grid-template-columns: 1fr; }
                    .stat-number { font-size: 1.5em; }
                }

                /* Mejorar scroll en móviles */
                .table-container {
                    overflow-x: auto;
                    -webkit-overflow-scrolling: touch;
                    scrollbar-width: thin;
                    scrollbar-color: #007bff #f1f1f1;
                }

                .table-container::-webkit-scrollbar {
                    height: 8px;
                }

                .table-container::-webkit-scrollbar-track {
                    background: #f1f1f1;
                    border-radius: 4px;
                }

                .table-container::-webkit-scrollbar-thumb {
                    background: #007bff;
                    border-radius: 4px;
                }

                .table-container::-webkit-scrollbar-thumb:hover {
                    background: #0056b3;
                }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1 class="welcome">👋 Bienvenido, ${usuario}!</h1>
                    <a href="/logout" class="logout-btn">Cerrar Sesión</a>
                </div>

                <div class="stats">
                    <div class="stat-card">
                        <div class="stat-number">68,031</div>
                        <div>Total de Registros</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-number">5</div>
                        <div>Comunas</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-number">100%</div>
                        <div>Datos Importados</div>
                    </div>
                </div>

                <div class="search-section">
                    <h2>🔍 Buscador de Datos</h2>
                    <p><strong>Buscar en:</strong> Dirección, NIS, Consecutivo o Serie del Medidor</p>

                    <form id="searchForm" style="margin-bottom: 20px;">
                        <div style="display: flex; gap: 10px; margin-bottom: 15px; flex-wrap: wrap;">
                            <input type="text" id="searchValue" placeholder="Ingresa el valor a buscar..."
                                   style="flex: 1; min-width: 200px; padding: 12px; border: 1px solid #ddd; border-radius: 5px; font-size: 16px;">
                            <select id="searchField" style="padding: 12px; border: 1px solid #ddd; border-radius: 5px; font-size: 16px; min-width: 140px;">
                                <option value="direccion">📍 Dirección</option>
                                <option value="nis">🔢 NIS</option>
                                <option value="consecutive">📋 Consecutivo</option>
                                <option value="serie_medidor">⚡ Serie Medidor</option>
                            </select>
                        </div>
                        <div style="display: flex; gap: 10px; flex-wrap: wrap;">
                            <button type="submit" style="flex: 1; min-width: 120px; padding: 12px 20px; background-color: #007bff; color: white; border: none; border-radius: 5px; cursor: pointer; font-size: 16px;">
                                🔍 Buscar
                            </button>
                            <button type="button" id="clearBtn" style="flex: 1; min-width: 120px; padding: 12px 20px; background-color: #6c757d; color: white; border: none; border-radius: 5px; cursor: pointer; font-size: 16px;">
                                🧹 Limpiar
                            </button>
                        </div>
                    </form>

                    <div id="searchResults" style="margin-top: 20px;">
                        <p style="color: #666; font-style: italic;">Ingresa un valor y selecciona el campo para buscar.</p>
                    </div>
                </div>

            </div>

            <script>
                document.getElementById('searchForm').addEventListener('submit', async function(e) {
                    e.preventDefault();

                    const valor = document.getElementById('searchValue').value.trim();
                    const campo = document.getElementById('searchField').value;

                    if (!valor) {
                        alert('Por favor ingresa un valor para buscar');
                        return;
                    }

                    const resultsDiv = document.getElementById('searchResults');
                    resultsDiv.innerHTML = '<p>🔍 Buscando...</p>';

                    try {
                        const response = await fetch('/api/buscar', {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                            },
                            body: JSON.stringify({ valor, campo })
                        });

                        const data = await response.json();

                        if (data.error) {
                            resultsDiv.innerHTML = '<p style="color: red;">❌ Error: ' + data.error + '</p>';
                            return;
                        }

                        if (data.resultados.length === 0) {
                            resultsDiv.innerHTML = '<p style="color: orange;">⚠️ No se encontraron resultados para "' + valor + '" en ' + campo + '</p>';
                            return;
                        }

                        // Si hay exactamente 1 resultado, mostrar transpuesto
                        if (data.resultados.length === 1) {
                            const registro = data.resultados[0];
                            let html = '<h3>✅ Resultado encontrado (1 registro)</h3>';
                            html += '<div class="table-container">';
                            html += '<table style="width: 100%; border-collapse: collapse; background: white;">';

                            Object.keys(registro).forEach(key => {
                                const valor = registro[key] || '';
                                html += '<tr style="border-bottom: 1px solid #ddd;">';
                                html += '<td style="padding: 8px; font-weight: bold; background: #f8f9fa; width: 200px;">' + key.toUpperCase() + '</td>';
                                html += '<td style="padding: 8px;">' + valor + '</td>';
                                html += '</tr>';
                            });

                            html += '</table></div>';
                            resultsDiv.innerHTML = html;
                        } else {
                            // Múltiples resultados - tabla normal
                            let html = '<h3>✅ Resultados encontrados (' + data.resultados.length + ' registros)</h3>';
                            html += '<div class="table-container">';
                            html += '<table style="width: 100%; border-collapse: collapse; background: white; min-width: 800px;">';

                            // Encabezados
                            html += '<thead><tr style="background: #007bff; color: white;">';
                            Object.keys(data.resultados[0]).forEach(key => {
                                html += '<th style="padding: 10px; text-align: left; white-space: nowrap;">' + key.toUpperCase() + '</th>';
                            });
                            html += '</tr></thead>';

                            // Filas
                            html += '<tbody>';
                            data.resultados.forEach((registro, index) => {
                                html += '<tr style="' + (index % 2 === 0 ? 'background: #f8f9fa;' : '') + '">';
                                Object.values(registro).forEach(valor => {
                                    html += '<td style="padding: 8px; border-bottom: 1px solid #ddd; white-space: nowrap;">' + (valor || '') + '</td>';
                                });
                                html += '</tr>';
                            });
                            html += '</tbody></table></div>';

                            resultsDiv.innerHTML = html;
                        }

                    } catch (error) {
                        console.error('Error:', error);
                        resultsDiv.innerHTML = '<p style="color: red;">❌ Error de conexión</p>';
                    }
                });

                document.getElementById('clearBtn').addEventListener('click', function() {
                    document.getElementById('searchValue').value = '';
                    document.getElementById('searchField').value = 'direccion';
                    document.getElementById('searchResults').innerHTML = '<p style="color: #666; font-style: italic;">Ingresa un valor y selecciona el campo para buscar.</p>';
                    document.getElementById('searchValue').focus();
                });
            </script>
        </body>
        </html>
    `);
});


app.get('/logout', (req, res) => {
    // Limpiar cookie JWT (con mismas opciones que al crearla)
    res.clearCookie('nikolito-token', {
        httpOnly: true,
        secure: true,
        sameSite: 'lax', // CRÍTICO: Debe coincidir con la configuración
        path: '/'
    });

    // Redirigir al login (sin sesiones)
    res.redirect('/login');
});

// API endpoint para búsquedas
app.post('/api/buscar', requireAuth, async (req, res) => {
    try {
        const { valor, campo } = req.body;

        // Validar parámetros
        if (!valor || !campo) {
            return res.status(400).json({ error: 'Valor y campo son requeridos' });
        }

        // Validar que el campo sea uno de los permitidos
        const camposPermitidos = ['direccion', 'nis', 'consecutive', 'serie_medidor'];
        if (!camposPermitidos.includes(campo)) {
            return res.status(400).json({ error: 'Campo no válido' });
        }

        // Obtener usuario para logs
        let usuarioLog = 'Usuario';
        if (req.userId) {
            usuarioLog = `ID:${req.userId}`;
        }

        console.log(`🔍 Búsqueda: "${valor}" en campo "${campo}" por usuario ${usuarioLog}`);

        let query = supabase
            .from('reporte_fnl')
            .select('*'); // Seleccionar todas las columnas

        let data, error;

        // Para campos numéricos, usar función personalizada
        if (campo === 'nis' || campo === 'consecutive') {
            const result = await supabase.rpc('buscar_numerico', {
                campo_nombre: campo,
                valor_buscar: valor
            });
            data = result.data;
            error = result.error;
        } else {
            // Para campos de texto, usar la API normal
            const result = await query.ilike(campo, `%${valor}%`).limit(100);
            data = result.data;
            error = result.error;
        }

        if (error) {
            console.error('Error en búsqueda:', error);
            return res.status(500).json({ error: 'Error en la búsqueda' });
        }

        console.log(`✅ Encontrados ${data.length} resultados`);

        res.json({
            resultados: data,
            total: data.length,
            campo: campo,
            valor: valor
        });

    } catch (error) {
        console.error('Error en API de búsqueda:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

app.listen(PORT, () => {
    console.log(`🚀 Servidor ejecutándose en http://localhost:${PORT}`);
    console.log('📊 Base de datos conectada a Supabase');
    console.log('👤 Usuarios disponibles: admin, marcelo, test');
    console.log('🔑 Contraseñas: admin123, marcelo123, test123');
    console.log('🔧 Modo: Solo JWT (sin sesiones en memoria)');
    console.log('🍪 Cookie sameSite: lax (optimizado para Vercel)');
});