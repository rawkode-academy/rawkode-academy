FROM --platform=$BUILDPLATFORM argoproj/argocd:v2.4.11 as build

USER root

RUN ln -s /usr/bin/dpkg-split /usr/sbin/dpkg-split && \
    ln -s /usr/bin/dpkg-deb /usr/sbin/dpkg-deb && \
    ln -s /bin/rm /usr/sbin/rm && \
    apt-get update && apt-get upgrade -y && \
    apt-get install -y --no-install-recommends \
    curl \
    python3-pip && \
    apt-get clean && \
    python3 -m pip install --no-cache-dir pdm

RUN curl -sS https://dl.yarnpkg.com/debian/pubkey.gpg | apt-key add - && \
    echo "deb https://dl.yarnpkg.com/debian/ stable main" | tee /etc/apt/sources.list.d/yarn.list && \
    apt-get update && apt-get install -y yarn && \
    yarn --ignore-engines global add npm cdk8s-cli

USER argocd
