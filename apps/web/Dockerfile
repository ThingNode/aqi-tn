FROM node:22-alpine AS build
WORKDIR /src
COPY package.json package-lock.json ./
COPY apps/web ./apps/web
RUN npm ci --workspace apps/web && npm run build --workspace apps/web
FROM nginx:1.27-alpine
COPY --from=build /src/apps/web/dist /usr/share/nginx/html/app
COPY infra/nginx.conf /etc/nginx/conf.d/default.conf

