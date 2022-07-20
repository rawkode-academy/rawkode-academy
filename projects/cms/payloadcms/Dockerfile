FROM node:18 AS build

WORKDIR /app
COPY . /app

RUN npm install
RUN npm run build:server

FROM node:18

WORKDIR /app
COPY --from=build /app/dist /app

ENTRYPOINT [ "node" ]
CMD [ "/app/server.js" ]
