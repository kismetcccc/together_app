import React, { useState } from "react";
import { Text, View, Pressable } from "react-native";
import {
  Button,
  Card,
  Field,
  Heading,
  Label,
  Body,
  Screen,
  colors,
  s,
} from "./UI";
export function AuthScreen({
  busy,
  onSubmit,
  onForgot,
  onLink,
}: {
  busy: boolean;
  onSubmit: (email: string, password: string, name?: string) => void;
  onForgot: (email: string) => void;
  onLink: () => void;
}) {
  const [register, setRegister] = useState(false),
    [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [name, setName] = useState(""),
    [show, setShow] = useState(false),
    [error, setError] = useState("");
  function submit() {
    if (!/^[^\s@]+@qq\.com$/i.test(email.trim()))
      return setError("请填写完整的 QQ 邮箱");
    if (password.length < 8 || password.length > 128)
      return setError("本站密码需要 8–128 位");
    if (register && !name.trim()) return setError("给自己取个名字吧");
    setError("");
    onSubmit(email, password, register ? name : undefined);
  }
  return (
    <Screen>
      <View style={{ gap: 8, alignItems: "center" }}>
        <Heading>喜欢的日子，一起存好。</Heading>
        <Body>一份私密相册，装下两个人的好时光。</Body>
      </View>
      <View
        style={{
          gap: 16,
          backgroundColor: colors.paper,
          padding: 22,
          borderRadius: 28,
        }}
      >
        <Text style={s.title}>
          {register ? "开启我们的故事" : "欢迎回到同频"}
        </Text>
        {register && (
          <Field
            label="你的昵称"
            value={name}
            onChangeText={setName}
            maxLength={24}
            autoComplete="name"
          />
        )}
        <Field
          label="QQ 邮箱"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          autoComplete="email"
        />
        <Field
          label="本站密码"
          value={password}
          onChangeText={setPassword}
          secureTextEntry={!show}
          autoCapitalize="none"
          autoComplete={register ? "new-password" : "current-password"}
        />
        <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={show ? "隐藏密码" : "显示密码"}
            onPress={() => setShow(!show)}
            style={{ minHeight: 44, justifyContent: "center" }}
          >
            <Text style={s.small}>{show ? "隐藏密码" : "显示密码"}</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            disabled={busy}
            onPress={() => onForgot(email)}
            style={{ minHeight: 44, justifyContent: "center" }}
          >
            <Text style={{ color: colors.ink, fontSize: 13 }}>忘记密码？</Text>
          </Pressable>
        </View>
        {!!error && (
          <Text accessibilityRole="alert" style={s.error}>
            {error}
          </Text>
        )}
        <Button
          title={register ? "注册并发送验证邮件" : "登录空间"}
          loading={busy}
          onPress={submit}
        />
        <Button
          secondary
          title={register ? "已有账号，去登录" : "没有账号？免费注册"}
          disabled={busy}
          onPress={() => {
            setRegister(!register);
            setError("");
          }}
        />
        <Pressable
          accessibilityRole="button"
          onPress={onLink}
          style={{
            minHeight: 44,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Text style={{ color: colors.ink, fontSize: 13 }}>
            收到好友邀请？打开链接 →
          </Text>
        </Pressable>
        <Text style={s.small}>
          请使用本站密码，不是 QQ 密码。注册后需通过邮箱验证，才可上传与分享。
        </Text>
      </View>
    </Screen>
  );
}
