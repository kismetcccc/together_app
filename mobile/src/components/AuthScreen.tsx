import React, { useState } from "react";
import { Text, View } from "react-native";
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
      <View style={{ paddingTop: 20, gap: 12 }}>
        <Label>TOGETHER · MADE FOR US</Label>
        <Heading>把时光，{"\n"}留给我们。</Heading>
        <Body>
          恋人、挚友，每一个重要的人。{"\n"}让那些普通的日子，也有一个归处。
        </Body>
      </View>
      <Card tone={colors.soft}>
        <Text style={{ fontSize: 36 }}>∞</Text>
        <Text style={s.title}>有你在，就是好天气。</Text>
        <Body>一个相册，两份视角，无数个一起。</Body>
      </Card>
      <View style={{ gap: 16 }}>
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
        <Button
          secondary
          title={show ? "隐藏密码" : "显示密码"}
          onPress={() => setShow(!show)}
        />
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
        <Button
          secondary
          title="忘记密码"
          disabled={busy}
          onPress={() => onForgot(email)}
        />
        <Button secondary title="打开邀请 / 验证链接" onPress={onLink} />
        <Text style={s.small}>
          请使用本站密码，不是 QQ 密码。注册后需通过邮箱验证，才可上传与分享。
        </Text>
      </View>
    </Screen>
  );
}
