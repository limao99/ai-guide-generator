package com.screencapture.service.impl;

import com.screencapture.dto.AnalysisResponse;
import com.screencapture.service.ImageAnalysisService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.multipart.MultipartFile;

import java.util.ArrayList;
import java.util.Base64;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Service
public class ImageAnalysisServiceImpl implements ImageAnalysisService {
    
    private static final Logger log = LoggerFactory.getLogger(ImageAnalysisServiceImpl.class);
    
    private final RestTemplate restTemplate = new RestTemplate();
    
    @Value("${deepseek.api.key:}")
    private String deepseekApiKey;
    
    @Value("${deepseek.api.endpoint:https://api.deepseek.com/v1/chat/completions}")
    private String deepseekApiEndpoint;
    
    @Value("${deepseek.api.model:deepseek-vision-v1.0}")
    private String deepseekModel;
    
    @Override
    public AnalysisResponse analyzeImage(MultipartFile imageFile, String language) {
        try {
            // 记录接收到的文件信息
            log.info("接收到图像分析请求: 文件名={}, 大小={}KB, 语言={}", 
                    imageFile.getOriginalFilename(),
                    imageFile.getSize() / 1024,
                    language);
            
            // 检查API密钥是否配置
            if (!isApiConfigured()) {
                log.warn("未配置API密钥，无法进行图像分析");
                return AnalysisResponse.builder()
                        .success(false)
                        .error("未配置图像分析API密钥，请在配置文件中设置deepseek.api.key")
                        .description("请配置图像分析API或手动添加描述。")
                        .build();
            }
            
            // 将图像转换为Base64（实际应用中，这里可能需要针对大型图像进行优化）
            byte[] imageBytes = imageFile.getBytes();
            String base64Image = Base64.getEncoder().encodeToString(imageBytes);
            
            // 调用模型API分析图像
            String description = analyzeImageWithAPI(base64Image, language);
            
            return AnalysisResponse.builder()
                    .success(true)
                    .description(description)
                    .build();
            
        } catch (Exception e) {
            log.error("图像分析失败", e);
            return AnalysisResponse.builder()
                    .success(false)
                    .error("图像分析过程中发生错误: " + e.getMessage())
                    .description("图像分析失败，请手动添加描述。")
                    .build();
        }
    }
    
    /**
     * 使用大模型API分析图像
     */
    private String analyzeImageWithAPI(String base64Image, String language) {
        try {
            // 根据不同语言准备不同的提示
            String promptTemplate;
            switch (language) {
                case "en":
                    promptTemplate = "Analyze this UI screenshot and provide a detailed description of what is shown. Focus on important UI elements and their functions.";
                    break;
                case "ja":
                    promptTemplate = "このUIスクリーンショットを分析し、表示されている内容の詳細な説明を提供してください。重要なUI要素とその機能に焦点を当ててください。";
                    break;
                case "ko":
                    promptTemplate = "이 UI 스크린샷을 분석하고 표시된 내용에 대한 자세한 설명을 제공하십시오. 중요한 UI 요소와 해당 기능에 중점을 두십시오.";
                    break;
                case "zh":
                default:
                    promptTemplate = "分析这个UI截图，提供详细描述。重点关注重要的UI元素及其功能，用专业但易懂的语言描述界面内容。";
                    break;
            }
            
            // 设置HTTP Headers
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            headers.set("Authorization", "Bearer " + deepseekApiKey);
            
            // 创建请求体
            Map<String, Object> requestBody = new HashMap<>();
            requestBody.put("model", deepseekModel);
            
            List<Map<String, Object>> messages = new ArrayList<>();
            
            // 系统指令
            Map<String, Object> systemMessage = new HashMap<>();
            systemMessage.put("role", "system");
            systemMessage.put("content", "你是一个专业的UI/UX分析助手，你的任务是分析屏幕截图并提供详细、专业的说明。");
            messages.add(systemMessage);
            
            // 用户消息 - 包含文本和图像
            Map<String, Object> userMessage = new HashMap<>();
            userMessage.put("role", "user");
            
            // 创建包含文本和图像的内容数组
            List<Map<String, Object>> contentList = new ArrayList<>();
            
            // 添加文本部分
            Map<String, Object> textContent = new HashMap<>();
            textContent.put("type", "text");
            textContent.put("text", promptTemplate);
            contentList.add(textContent);
            
            // 添加图像部分
            Map<String, Object> imageContent = new HashMap<>();
            imageContent.put("type", "image");
            
            Map<String, String> imageData = new HashMap<>();
            imageData.put("mime_type", "image/jpeg");
            imageData.put("data", base64Image);
            
            imageContent.put("image", imageData);
            contentList.add(imageContent);
            
            // 设置完整content
            userMessage.put("content", contentList);
            messages.add(userMessage);
            
            requestBody.put("messages", messages);
            requestBody.put("max_tokens", 500);  // 允许更长的响应
            requestBody.put("temperature", 0.5); // 较低的随机性，更加精确
            
            // 创建HTTP请求
            HttpEntity<Map<String, Object>> requestEntity = new HttpEntity<>(requestBody, headers);
            
            // 调用API
            log.info("正在调用图像分析API...");
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
                    Map<String, Object> message = (Map<String, Object>) choice.get("message");
                    if (message != null && message.containsKey("content")) {
                        log.info("成功获取图像分析结果");
                        return (String) message.get("content");
                    }
                }
            }
            
            // 如果无法解析响应
            log.warn("API返回了无效的响应格式");
            return "无法解析API响应，请手动添加描述。";
            
        } catch (Exception e) {
            log.error("调用图像分析API失败", e);
            return "调用图像分析API失败: " + e.getMessage() + "。请手动添加描述。";
        }
    }
    
    /**
     * 检查API配置是否有效
     */
    private boolean isApiConfigured() {
        return deepseekApiKey != null && !deepseekApiKey.isEmpty();
    }
} 