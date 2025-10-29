FROM node:20-slim

WORKDIR /app

COPY package.json pnpm-lock.yaml* pnpm-workspace.yaml tsconfig.json tsconfig.base.json ./
RUN corepack enable pnpm && pnpm install --frozen-lockfile || pnpm install

COPY . .

RUN pnpm build

CMD ["node", "app/dist/main.js"]
