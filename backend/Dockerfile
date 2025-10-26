# 1. Comece com uma imagem base oficial do Python (3.11 é super estável)
FROM python:3.11-slim

# 2. Define o diretório de trabalho dentro do contêiner
WORKDIR /app

# 3. ATUALIZA o gerenciador de pacotes (apt-get) e INSTALA a biblioteca que falta
# "libpq-dev" é o pacote que contém o "libpq.so.5"
RUN apt-get update && apt-get install -y \
    libpq-dev \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# 4. Copia o arquivo de dependências do Python
COPY ./requirements.txt /app/requirements.txt

# 5. Instala as dependências do Python
RUN pip install --no-cache-dir -r /app/requirements.txt

# 6. Copia todo o resto do seu código do backend para o contêiner
COPY . /app

# 7. (Opcional, mas boa prática) Expõe a porta
# O Railway vai usar a variável $PORT de qualquer maneira
EXPOSE 8080

# 8. O comando de início (O Railway vai usar o seu "Start Command" em vez deste,
# mas é bom ter um padrão)
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8080"]