FROM argoproj/argocd:v2.4.11

USER root

ENV DEBIAN_FRONTEND noninteractive

RUN apt update \
    && apt install --yes curl \
    && curl -fsSL https://deb.nodesource.com/setup_18.x | bash - \
    && curl -fsSL https://dl.yarnpkg.com/debian/pubkey.gpg | apt-key add - \
    && echo "deb https://dl.yarnpkg.com/debian/ stable main" | tee /etc/apt/sources.list.d/yarn.list \
    && apt update \
    && apt install --yes nodejs yarn \
    && yarn --ignore-engines global add npm cdk8s-cli

USER 999
