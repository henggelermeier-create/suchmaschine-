FROM node:20-alpine
WORKDIR /app/services/worker
COPY services/worker/package.json package.json
RUN npm install --omit=dev
COPY services/worker ./
COPY database /app/database
CMD ["npm","start"]
