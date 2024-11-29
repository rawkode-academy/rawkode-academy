FROM ghcr.io/cloudnative-pg/postgresql:16-bookworm

USER root

RUN apt update && apt install -y -V ca-certificates lsb-release wget
RUN wget https://apache.jfrog.io/artifactory/arrow/$(lsb_release --id --short | tr 'A-Z' 'a-z')/apache-arrow-apt-source-latest-$(lsb_release --codename --short).deb
RUN apt install -y -V ./apache-arrow-apt-source-latest-$(lsb_release --codename --short).deb
RUN wget https://packages.groonga.org/debian/groonga-apt-source-latest-$(lsb_release --codename --short).deb
RUN  apt install -y -V ./groonga-apt-source-latest-$(lsb_release --codename --short).deb
RUN apt update

RUN apt update && apt install -y -V postgresql-16-pgdg-pgroonga groonga-tokenizer-mecab hunspell-en-us hunspell-en-gb hunspell-de-de hunspell-fr hunspell-es

RUN ln -sf /usr/share/hunspell/en_US.dic /usr/share/postgresql/16/tsearch_data/en_us.dict
RUN ln -sf /usr/share/hunspell/en_US.aff /usr/share/postgresql/16/tsearch_data/en_us.affix
RUN ln -sf /usr/share/hunspell/en_GB.dic /usr/share/postgresql/16/tsearch_data/en_gb.dict
RUN ln -sf /usr/share/hunspell/en_GB.aff /usr/share/postgresql/16/tsearch_data/en_gb.affix
RUN ln -sf /usr/share/hunspell/de_DE.dic /usr/share/postgresql/16/tsearch_data/de_de.dict
RUN ln -sf /usr/share/hunspell/de_DE.aff /usr/share/postgresql/16/tsearch_data/de_de.affix
RUN ln -sf /usr/share/hunspell/fr.dic /usr/share/postgresql/16/tsearch_data/fr.dict
RUN ln -sf /usr/share/hunspell/fr.aff /usr/share/postgresql/16/tsearch_data/fr.affix
RUN ln -sf /usr/share/hunspell/es.dic /usr/share/postgresql/16/tsearch_data/es.dict
RUN ln -sf /usr/share/hunspell/es.aff /usr/share/postgresql/16/tsearch_data/es.affix

COPY stop.en /usr/share/postgresql/tsearch_data/zulip_english.stop

# Change to the uid of postgres (26)
USER 26
