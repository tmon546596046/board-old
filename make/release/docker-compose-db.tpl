version: '2'
services:
  db:
    image: board_db:__version__
    restart: always
    volumes:
      - /data/board/database:/var/lib/mysql
      - ../config/db/my.cnf:/etc/mysql/conf.d/my.cnf
    env_file:
      - ../config/db/env
    networks:
      - dvserver_net
    ports:
      - 3306:3306
    ulimits:
      nofile:
        soft: 65536
        hard: 65536
networks:
  dvserver_net:
    external:
      name: dev_board
