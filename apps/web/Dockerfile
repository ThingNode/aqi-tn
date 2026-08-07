FROM node:22-alpine AS build
WORKDIR /src
COPY package.json package-lock.json ./
COPY apps/web ./apps/web
COPY apps/site ./apps/site
RUN npm ci --workspace apps/web --workspace apps/site && npm run build --workspace apps/web --workspace apps/site
FROM nginx:1.27-alpine
COPY --from=build /src/apps/web/dist /usr/share/nginx/html/app
COPY --from=build /src/apps/site/dist /usr/share/nginx/html
COPY infra/nginx.conf /etc/nginx/conf.d/default.conf

