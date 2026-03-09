-- Si es un archivo CSV:
SELECT * FROM 'datos/partidas.csv' LIMIT 10;

-- O si tienes la función automática (es lo mismo):
SELECT * FROM read_csv_auto('datos/partidas.csv') LIMIT 10;