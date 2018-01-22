version: '2'
services:
  log:
    image: board_log:__version__
    restart: always
    volumes:
      - /var/log/board/:/var/log/docker/
    networks:
      - board
    ports:
      - 1514:514
  db:
    image: board_db:__version__
    restart: always
    volumes:
      - /data/board/database:/var/lib/mysql
    env_file:
      - ../config/db/env
    networks:
      - board
    depends_on:
      - log
    logging:
      driver: "syslog"
      options:  
        syslog-address: "tcp://127.0.0.1:1514"
        tag: "db"
  gitserver:
    image: board_gitserver:__version__
    restart: always
    volumes:
      - /data/board/gitserver/repos:/gitserver/repos
      - ../config/ssh_keys:/gitserver/keys
    networks:
      - board
    links:
      - jenkins
    depends_on:
      - log
    logging:
      driver: "syslog"
      options:
        syslog-address: "tcp://127.0.0.1:1514"
        tag: "gitserver"
  jenkins:
    image: board_jenkins:__version__
    restart: always
    networks:
      - board
    volumes:
      - /data/board/jenkins_home:/var/jenkins_home
      - ../config/ssh_keys:/root/.ssh
      - /var/run/docker.sock:/var/run/docker.sock
      - /usr/bin/docker:/usr/bin/docker
    env_file:
      - ../config/jenkins/env
    ports:
      - 50000:50000
    depends_on:
      - log
    logging:
      driver: "syslog"
      options:
        syslog-address: "tcp://127.0.0.1:1514"
        tag: "jenkins"
  apiserver:
    image: board_apiserver:__version__
    restart: always
    volumes:
      - ../config/apiserver/app.conf:/usr/bin/app.conf:z
#     - ../../tools/swagger/vendors/swagger-ui-2.1.4/dist:/usr/bin/swagger:z
      - ../config/ssh_keys:/root/.ssh
      - /data/board/gitserver/repos:/repos
    env_file:
      - ../config/apiserver/env
    networks:
      - board
    links:
      - db
      - gitserver
    ports: 
      - 8088:8088
    depends_on:
      - log
    logging:
      driver: "syslog"
      options:
        syslog-address: "tcp://127.0.0.1:1514"
        tag: "apiserver"
  tokenserver:
    image: board_tokenserver:__version__
    env_file:
      - ../config/tokenserver/env
    restart: always
    volumes:
      - ../config/tokenserver/app.conf:/usr/bin/app.conf:z
    networks:
      - board
    depends_on:
      - log
    logging:
      driver: "syslog"
      options:
        syslog-address: "tcp://127.0.0.1:1514"
        tag: "tokenserver"
  collector:
    image: board_collector:__version__
    restart: always
    env_file:
      - ../config/collector/env
    networks:
      - board
    links:
      - db
    depends_on:
      - log
      - db
    logging:
      driver: "syslog"
      options:
        syslog-address: "tcp://127.0.0.1:1514"
        tag: "collector" 
  proxy:
    image: board_proxy:__version__
    networks:
      - board
    restart: always
    volumes:
      - ../config/proxy/nginx.conf:/etc/nginx/nginx.conf:z
#     - ../../src/ui/dist:/usr/share/nginx/html:z
    ports: 
      - 80:80
    links:
      - apiserver
    depends_on:
      - log
    logging:
      driver: "syslog"
      options:
        syslog-address: "tcp://127.0.0.1:1514"
        tag: "proxy"
networks:
  board:
    external: false
