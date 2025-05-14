package com.screencapture.controller;

import com.screencapture.dto.AnalysisRequest;
import com.screencapture.dto.AnalysisResponse;
import com.screencapture.service.ImageAnalysisService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping("/api/analysis")
@RequiredArgsConstructor
@CrossOrigin(origins = "*") // 开发模式下允许跨域访问
public class ImageAnalysisController {

    private final ImageAnalysisService imageAnalysisService;

    @PostMapping(value = "/image", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public AnalysisResponse analyzeImage(
            @RequestPart("image") MultipartFile imageFile,
            @RequestParam(value = "language", defaultValue = "zh") String language) {
        
        return imageAnalysisService.analyzeImage(imageFile, language);
    }     
} 