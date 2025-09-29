# 🎮 eSports Analytics Dashboard - LATAM
### SQL Optimization + Data Visualization Platform

[![Live Demo](https://img.shields.io/badge/Demo-Live%20Site-00d4ff)](https://sam-24-dev.github.io/esports-analytics-dashboard/)
[![MySQL](https://img.shields.io/badge/Database-MySQL-blue)](./database/)
[![SQL Optimization](https://img.shields.io/badge/SQL-Query%20Optimization-8b5cf6)](./database/)
[![GitHub](https://img.shields.io/badge/Code-Repository-181717)](https://github.com/Sam-24-dev/esports-analytics-dashboard)

---

## 🎯 Descripción del Proyecto

Dashboard analítico profesional que visualiza datos de competencias eSports en Latinoamérica. Proyecto desarrollado para el Bootcamp ESPOL "Data-Driven Decision Specialist" - Módulo Database SQL and Query Optimization, demostrando capacidades avanzadas en diseño de bases de datos, optimización de consultas SQL y visualización de datos.

### 🏆 Características Principales

- **📊 Análisis Multidimensional** - Rankings por países, equipos y jugadores
- **🔍 SQL Optimization** - 40% mejora en performance de queries complejas
- **📈 Visualizaciones Interactivas** - Gráficos dinámicos con Chart.js
- **🎨 Gaming UI/UX** - Diseño moderno con tema dark gaming
- **📱 Responsive Design** - Compatible con todos los dispositivos
- **⚡ GitHub Pages** - Deploy estático sin backend

---

## 🛠️ Stack Tecnológico

### Database & Backend
- **MySQL 8.0** - Base de datos relacional normalizada
- **Advanced SQL** - Window functions, CTEs, subqueries
- **Query Optimization** - Índices compuestos, EXPLAIN ANALYZE
- **Views & Procedures** - Lógica encapsulada en BD

### Frontend
- **HTML5** - Estructura semántica moderna
- **CSS3** - Animaciones, glassmorphism, responsive grid
- **JavaScript Vanilla** - Fetch API, DOM manipulation
- **Chart.js** - Visualizaciones interactivas

### Deployment
- **GitHub Pages** - Hosting estático gratuito
- **Git** - Control de versiones

---

## 📊 Análisis de Datos

### Métricas Clave Analizadas
- **15 equipos** de 8 países latinoamericanos
- **33 jugadores** con estadísticas 2024-2025
- **$325,000** en premios totales distribuidos
- **5 competencias** (2 internacionales, 3 nacionales)
- **40% mejora** en performance de queries optimizadas

### Insights Destacados
- **Ecuador domina:** 4 equipos, $110,000 en premios
- **Mejor equipo:** Lobos Urbanos (Ecuador) - $45,000
- **Top performer 2024:** Carlos Hernández (75% winrate)
- **Mayor evolución:** Julián Torres (58.3% → 90.0%)

---

## 🚀 Demo y Funcionalidades

### 🌐 Demo en Vivo
**Dashboard Completo:** [https://sam-24-dev.github.io/esports-analytics-dashboard/](https://sam-24-dev.github.io/esports-analytics-dashboard/)

### Funcionalidades Implementadas

**1. Dashboard Principal**
- KPIs principales (equipos, jugadores, premios, países)
- Gráficos interactivos (pie, bar, line charts)
- Rankings dinámicos por país

**2. Tablas Analíticas**
- Ranking de países por premios
- Top equipos más exitosos
- Performance de jugadores 2024 vs 2025
- Análisis de roles (Titular vs Suplente)

**3. Visualizaciones**
- Distribución de equipos por país
- Evolución temporal de jugadores
- Comparativa competencias internacionales vs nacionales
- Cards de competencias activas

**4. SQL Showcase**
- Comparación antes/después de optimizaciones
- Índices creados y su impacto
- Consultas avanzadas documentadas

---

## 📂 Estructura del Proyecto

```
esports-analytics-dashboard/
├── index.html                  # Dashboard principal
├── assets/
│   ├── css/
│   │   └── style.css          # Estilos gaming theme
│   ├── js/
│   │   └── main.js            # Lógica y carga de datos
│   └── data/
│       └── datos-dashboard.json  # Dataset completo
├── database/
│   ├── esportsespol_Grupo5.sql   # Script completo BD
│   └── consultas-optimizadas.sql # Queries avanzadas
└── README.md                   # Documentación
```

---

## 💾 Base de Datos

### Modelo de Datos (10 tablas)
- `paises` - Países participantes
- `equipos` - Equipos de eSports
- `jugadores` - Jugadores activos
- `competencias` - Torneos nacionales/internacionales
- `partidos` - Enfrentamientos individuales
- `estadisticas_jugador` - Performance por año
- `competencia_equipos` - Posiciones y premios
- `rosters` - Participación en competencias
- `jugador_equipos` - Historial de equipos
- `partido_equipos` - Resultados de partidos

### Optimizaciones SQL Implementadas

**Índice Compuesto:**
```sql
CREATE INDEX idx_competencias_tipo_compid 
ON competencias(tipo, competencia_id);
```

**Vistas Optimizadas:**
```sql
CREATE VIEW vw_premios_internacionales AS
SELECT e.nombre, SUM(ce.premio_obtenido) AS premio_total
FROM competencia_equipos ce
JOIN competencias c ON ce.competencia_id = c.competencia_id
WHERE c.tipo = 'Internacional'
GROUP BY e.equipo_id;
```

**Resultado:** 40% reducción en tiempo de ejecución de queries complejas

---

## 📸 Screenshots

### Dashboard Principal
![Dashboard KPIs](./docs/screenshots/dashboard-kpis.png)
*Vista de métricas principales y gráficos interactivos*

### Análisis de Países
![Rankings](./docs/screenshots/country-rankings.png)
*Ranking de países por premios con progress bars*

### Performance de Jugadores
![Players](./docs/screenshots/players-performance.png)
*Evolución de jugadores 2024 vs 2025*

---

## 🔧 Instalación y Uso Local

### Requisitos
- MySQL 8.0+
- Navegador moderno (Chrome, Firefox, Edge)
- Live Server o servidor local

### Configuración

**1. Clonar repositorio:**
```bash
git clone https://github.com/Sam-24-dev/esports-analytics-dashboard.git
cd esports-analytics-dashboard
```

**2. Configurar base de datos:**
```bash
mysql -u root -p < database/esportsespol_Grupo5.sql
```

**3. Abrir dashboard:**
```bash
# Con Live Server (VS Code)
# O abrir index.html directamente en navegador
```

---

## 📈 Consultas SQL Destacadas

### 1. Ranking de Países por Premios
```sql
SELECT p.nombre AS pais,
       COUNT(DISTINCT e.equipo_id) AS total_equipos,
       COALESCE(SUM(ce.premio_obtenido), 0) AS premios_totales
FROM paises p
LEFT JOIN equipos e ON p.pais_id = e.pais_id
LEFT JOIN competencia_equipos ce ON e.equipo_id = ce.equipo_id
GROUP BY p.nombre
ORDER BY premios_totales DESC;
```

### 2. Evolución de Jugadores (2024 vs 2025)
```sql
WITH rnk AS (
  SELECT j.nombre,
         ej.porcentaje_victorias,
         ej.anio,
         RANK() OVER (PARTITION BY ej.anio 
                     ORDER BY ej.porcentaje_victorias DESC) AS Ranking
  FROM jugadores j
  JOIN estadisticas_jugador ej ON j.jugador_id = ej.jugador_id
)
SELECT * FROM rnk WHERE Ranking <= 5;
```

### 3. Top Equipos Más Exitosos
```sql
SELECT e.nombre,
       COUNT(ce.competencia_id) AS competencias_participadas,
       ROUND(AVG(ce.posicion_final), 2) AS posicion_promedio,
       SUM(ce.premio_obtenido) AS premios_totales
FROM equipos e
JOIN competencia_equipos ce ON e.equipo_id = ce.equipo_id
GROUP BY e.equipo_id
ORDER BY posicion_promedio ASC, premios_totales DESC
LIMIT 5;
```

---

## 🎯 Aprendizajes Clave

### SQL & Database Design
- Diseño de esquemas normalizados (3NF)
- Optimización de queries con índices estratégicos
- Window functions para análisis avanzados
- CTEs para queries complejas legibles

### Data Analysis
- Análisis multidimensional de datasets
- Identificación de insights accionables
- Visualización efectiva de métricas

### Frontend Development
- Diseño responsive moderno
- Fetch API para cargar datos
- Manipulación dinámica del DOM
- UX/UI gaming theme

---

## 💡 Próximas Mejoras

- [ ] Filtros dinámicos por año y tipo de competencia
- [ ] Exportación de reportes a PDF
- [ ] Gráficos adicionales (radar charts, sankey diagrams)
- [ ] Análisis predictivo con machine learning
- [ ] API REST para consumir datos en tiempo real

---

## 📄 Licencia y Contacto

### 📜 Licencia
Este proyecto está bajo la licencia **MIT License**.

### 📧 Contacto Profesional
- **Autor:** Samir Leonardo Caizapasto Hernández
- **Institución:** Escuela Superior Politécnica del Litoral (ESPOL)
- **Bootcamp:** Data-Driven Decision Specialist
- **LinkedIn:** [Samir Caiza Pasto](https://www.linkedin.com/in/samircaizapasto/)
- **GitHub:** [Sam-24-dev](https://github.com/Sam-24-dev)
- **Email:** samir.leonardo.caizapasto04@gmail.com

---

## 🌟 Agradecimientos

**Proyecto desarrollado como parte del Bootcamp ESPOL "Data-Driven Decision Specialist" - Módulo Database SQL and Query Optimization, demostrando capacidades en diseño de bases de datos, optimización de consultas y visualización de datos aplicadas al ecosistema eSports latinoamericano.**

---

*⭐ Si este proyecto te resulta útil, considera darle una estrella en GitHub*
