FROM node:18 AS build

WORKDIR /app

COPY .npmrc package.json package-lock.json /app/
RUN npm clean-install

COPY . /app/
RUN npm run build:server

FROM node:18

WORKDIR /app

COPY --from=build /app/dist /app
COPY --from=build /app/node_modules /app/node_modules

ENTRYPOINT [ "node" ]
CMD [ "server.js" ]
