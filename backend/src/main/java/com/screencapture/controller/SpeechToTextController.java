package com.screencapture.controller;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.multipart.MultipartFile;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/speech-to-text")
@RequiredArgsConstructor
@CrossOrigin(origins = "*") // 开发模式下允许跨域访问
@Slf4j
public class SpeechToTextController {

    @Value("${deepseek.api.key:}")
    private String deepseekApiKey;
    
    @Value("${deepseek.api.endpoint:https://api.deepseek.com/v1/chat/completions}")
    private String deepseekApiEndpoint;
    
    @Value("${deepseek.api.model:deepseek-chat}")
    private String deepseekModel;
    
    private final RestTemplate restTemplate = new RestTemplate();

    @PostMapping(consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public Map<String, Object> convertSpeechToText(
            @RequestPart(value = "audio", required = false) MultipartFile audioFile,
            @RequestParam(value = "timestamp", required = false) String timestamp) {
        
        log.info("收到语音转文字请求, 时间戳: {}", timestamp);
        Map<String, Object> response = new HashMap<>();
        
        if (audioFile != null && !audioFile.isEmpty()) {
            try {
                // 尝试使用DeepSeek模型处理真实的音频文件
                if (isDeepSeekConfigured()) {
                    // 在实际应用中，这里应该处理音频文件，可能需要调用专门的语音识别API
                    // 然后将结果发送给DeepSeek进行润色
                    
                    // 假设我们已经有了音频识别的原始结果（这部分需要实际集成语音识别API）
                    String rawTranscription = processAudioFile(audioFile);
                    
                    // 使用DeepSeek增强描述
                    String enhancedText = enhanceTranscriptionWithDeepSeek(rawTranscription);
                    
                    response.put("success", true);
                    response.put("text", enhancedText);
                    response.put("isAI", true);
                    return response;
                }
            } catch (Exception e) {
                log.error("音频处理失败", e);
                // 失败时返回错误信息，让前端决定如何处理
                response.put("success", false);
                response.put("error", "音频处理失败: " + e.getMessage());
                response.put("text", "请手动输入您的描述");
                return response;
            }
        }
        
        // 如果没有音频文件或处理失败，返回通知让用户手动输入
        response.put("success", false);
        response.put("error", "没有收到音频文件或音频处理失败");
        response.put("text", "请手动输入您的描述");
        
        return response;
    }
    
    /**
     * 处理音频文件转文本（实际应用中需要接入语音识别API）
     */
    private String processAudioFile(MultipartFile audioFile) {
        // 这里应该集成真实的语音识别API，如Google Speech-to-Text, Azure语音识别等
        // 由于没有实际实现，我们目前只返回一个基本的提示信息
        log.info("需要集成实际的语音识别API来处理音频文件: {}, 大小: {}KB", 
                audioFile.getOriginalFilename(), audioFile.getSize() / 1024);
                
        // 返回一个提示，表明需要集成实际的API
        return "语音识别API尚未集成，请手动输入描述";
    }
    
    /**
     * 使用DeepSeek API增强语音转文字的结果
     */
    private String enhanceTranscriptionWithDeepSeek(String transcription) {
        try {
            if (!isDeepSeekConfigured()) {
                return transcription;
            }
            
            // 设置HTTP Headers
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            headers.set("Authorization", "Bearer " + deepseekApiKey);
            
            // 创建请求体
            Map<String, Object> requestBody = new HashMap<>();
            requestBody.put("model", deepseekModel);
            
            List<Map<String, String>> messages = new ArrayList<>();
            // 系统指令
            Map<String, String> systemMessage = new HashMap<>();
            systemMessage.put("role", "system");
            systemMessage.put("content", "你是一个专业的UI/UX分析助手，你的任务是将用户对界面的简短描述转换为详细、专业的说明。保持描述简洁但信息丰富。");
            messages.add(systemMessage);
            
            // 用户消息
            Map<String, String> userMessage = new HashMap<>();
            userMessage.put("role", "user");
            userMessage.put("content", "请基于以下转录内容，生成一个更详细、专业的UI元素描述：" + transcription);
            messages.add(userMessage);
            
            requestBody.put("messages", messages);
            requestBody.put("max_tokens", 150);
            requestBody.put("temperature", 0.7);
            
            // 创建HTTP请求
            HttpEntity<Map<String, Object>> requestEntity = new HttpEntity<>(requestBody, headers);
            
            // 调用API
            ResponseEntity<Map> responseEntity = restTemplate.postForEntity(
                deepseekApiEndpoint, 
                requestEntity, 
                Map.class
            );
            
            // 解析响应
            Map<String, Object> responseBody = responseEntity.getBody();
            if (responseBody != null && responseBody.containsKey("choices")) {
                List<Map<String, Object>> choices = (List<Map<String, Object>>) responseBody.get("choices");
                if (!choices.isEmpty()) {
                    Map<String, Object> choice = choices.get(0);
                    Map<String, String> message = (Map<String, String>) choice.get("message");
                    if (message != null && message.containsKey("content")) {
                        return message.get("content");
                    }
                }
            }
            
            return transcription; // 如果无法解析响应，返回原始文本
        } catch (Exception e) {
            log.error("DeepSeek API调用失败", e);
            return transcription; // 如果失败，返回原始文本
        }
    }
    
    /**
     * 检查DeepSeek配置是否有效
     */
    private boolean isDeepSeekConfigured() {
        return deepseekApiKey != null && !deepseekApiKey.isEmpty();
    }
} 