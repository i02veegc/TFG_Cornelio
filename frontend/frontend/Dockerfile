FROM node:20-alpine

WORKDIR /usr/src/app

COPY package.json package-lock.json* ./
RUN npm install

COPY . ./

ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_MQTT_URL
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}
ENV NEXT_PUBLIC_MQTT_URL=${NEXT_PUBLIC_MQTT_URL}
ENV PORT=3001

RUN npm run build

EXPOSE 3001
CMD ["npm", "start", "--", "-p", "3001"]
