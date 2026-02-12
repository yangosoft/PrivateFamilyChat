# PrivateFamilyChat

Private family chat application using Ionic, VUE and Nodejs

Is not complete, is just a example.

For real applications use [Matrix](https://matrix.org/)

# Android App

```
$ cd FamilyChat/
$ npm i
$ ionic capacitor add android
$ ionic build
$ ionic capacitor sync
```

Application can be built using Android Studio.

# Backend

```
$ cd familychatserver/
$ npm i
$ npm run start
```

## Docker compose

Backend can be deployed in a docker container

```
$ cd familychatserver/
$ cd familychatserver/
$ npm i
$ docker compose up -d
```



