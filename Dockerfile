FROM node
ENV DO_NOT_TRACK=1
RUN npx wrangler --version
WORKDIR /app
EXPOSE 8787/tcp
CMD env >> .env && exec npx wrangler dev
COPY . .
