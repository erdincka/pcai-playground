{{- define "playground.fullname" -}}
{{- printf "%s-%s" .Release.Name .Chart.Name | trunc 63 | trimSuffix "-" -}}
{{- end -}}

{{- define "playground.labels" -}}
helm.sh/chart: {{ .Chart.Name }}-{{ .Chart.Version | replace "+" "_" }}
{{ include "playground.selectorLabels" . }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{- end -}}


{{- define "playground.serviceAccount" -}}
{{- printf "%s-%s" .Release.Name .Chart.Name | trunc 63 | trimSuffix "-" -}}
{{- end -}}

{{/*
Selector labels
*/}}
{{- define "playground.selectorLabels" -}}
{{ include "hpe-ezua.labels" . }}
app.kubernetes.io/name: {{ include "playground.fullname" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end }}